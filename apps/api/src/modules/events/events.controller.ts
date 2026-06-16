import type { RequestHandler } from "express";

import { HttpError } from "../../core/errors/http-error.js";
import "../auth/auth.request.js";
import { eventsService, type EventsService } from "./events.service.js";

type EventsControllerOptions = {
  heartbeatMs?: number;
};

export type EventsController = {
  streamEvents: RequestHandler;
};

export const createEventsController = (
  service: EventsService = eventsService,
  { heartbeatMs = 25000 }: EventsControllerOptions = {}
): EventsController => ({
  streamEvents: (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

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

      const unsubscribe = service.subscribe(req.currentUser.id, res);
      const heartbeat = setInterval(() => {
        res.write(": heartbeat\n\n");
      }, heartbeatMs);

      req.on("close", () => {
        clearInterval(heartbeat);
        unsubscribe();
      });
    } catch (error) {
      next(error);
    }
  }
});

export const eventsController = createEventsController();
