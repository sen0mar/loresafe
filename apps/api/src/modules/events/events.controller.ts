import type { Request, RequestHandler } from "express";

import { env } from "../../config/env.js";
import { HttpError } from "../../core/errors/http-error.js";
import { authService } from "../auth/auth.service.js";
import "../auth/auth.request.js";
import { eventsService, type EventsService } from "./events.service.js";

type EventsControllerOptions = {
  heartbeatMs?: number;
  isSessionValid?: (request: Request, userId: string) => Promise<boolean>;
};

export type EventsController = {
  streamEvents: RequestHandler;
};

const defaultSessionValidator = async (request: Request, userId: string) => {
  const rawCookie = request.cookies?.[env.SESSION_COOKIE_NAME] as unknown;
  const user = await authService.resolveCurrentUser(
    typeof rawCookie === "string" ? rawCookie : undefined
  );

  return user?.id === userId;
};

export const createEventsController = (
  service: EventsService = eventsService,
  {
    heartbeatMs = 25_000,
    isSessionValid = defaultSessionValidator
  }: EventsControllerOptions = {}
): EventsController => ({
  streamEvents: (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const userId = req.currentUser.id;
      const subscription = service.subscribe(
        userId,
        req.ip || req.socket.remoteAddress || "unknown",
        res
      );

      res.status(200);
      res.set({
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream",
        "X-Accel-Buffering": "no"
      });
      res.flushHeaders();
      res.write("retry: 3000\n\n");
      res.write(": connected\n\n");

      let isRevalidating = false;
      let closed = false;
      const close = () => {
        if (closed) {
          return;
        }

        closed = true;
        clearInterval(heartbeat);
        subscription.close();
      };
      const heartbeat = setInterval(() => {
        if (isRevalidating || closed) {
          return;
        }

        isRevalidating = true;
        void isSessionValid(req, userId)
          .then((isValid) => {
            if (!isValid || !subscription.heartbeat()) {
              close();
            }
          })
          .catch(close)
          .finally(() => {
            isRevalidating = false;
          });
      }, heartbeatMs);

      req.once("close", close);
      res.once("close", close);
    } catch (error) {
      next(error);
    }
  }
});

export const eventsController = createEventsController();
