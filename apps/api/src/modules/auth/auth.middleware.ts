import type { RequestHandler } from "express";

import { env } from "../../config/env.js";
import { HttpError } from "../../core/errors/http-error.js";
import { authService, type AuthService } from "./auth.service.js";
import "./auth.request.js";

export type AuthMiddleware = {
  loadCurrentUser: RequestHandler;
  requireUser: RequestHandler;
};

export const createAuthMiddleware = (
  service: AuthService = authService
): AuthMiddleware => ({
  loadCurrentUser: async (req, _res, next) => {
    try {
      const sessionToken = getSessionCookie(req.cookies);

      // Invalid or expired sessions stay nullable here so routes can opt into auth with requireUser.
      req.currentUser = await service.resolveCurrentUser(sessionToken);
      next();
    } catch (error) {
      next(error);
    }
  },

  requireUser: (req, _res, next) => {
    if (!req.currentUser) {
      next(authenticationRequiredError());
      return;
    }

    next();
  }
});

export const authMiddleware = createAuthMiddleware();

const getSessionCookie = (cookies: unknown) => {
  if (!cookies || typeof cookies !== "object") {
    return undefined;
  }

  const sessionCookie = (cookies as Record<string, unknown>)[
    env.SESSION_COOKIE_NAME
  ];

  return typeof sessionCookie === "string" ? sessionCookie : undefined;
};

const authenticationRequiredError = () =>
  new HttpError(401, "UNAUTHORIZED", "Authentication required");
