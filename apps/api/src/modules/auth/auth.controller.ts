import type { RequestHandler } from "express";

import { env } from "../../config/env.js";
import { HttpError } from "../../core/errors/http-error.js";
import {
  clearedSessionCookieOptions,
  sessionCookieOptions
} from "../../core/security/session-token.js";
import { authService, type AuthService } from "./auth.service.js";
import { loginRequestSchema, signupRequestSchema } from "./auth.schema.js";
import "./auth.request.js";

export type AuthController = {
  login: RequestHandler;
  logout: RequestHandler;
  me: RequestHandler;
  signup: RequestHandler;
};

export const createAuthController = (
  service: AuthService = authService
): AuthController => ({
  signup: async (req, res, next) => {
    try {
      const parseResult = signupRequestSchema.safeParse(req.body);

      if (!parseResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the signup fields and try again."
        );
      }

      const result = await service.signup(parseResult.data);

      // Keep the JWT out of the JSON response so browser JavaScript cannot read it.
      res.cookie(
        env.SESSION_COOKIE_NAME,
        result.sessionToken,
        sessionCookieOptions
      );
      res.status(201).json({
        user: result.user
      });
    } catch (error) {
      next(error);
    }
  },

  login: async (req, res, next) => {
    try {
      const parseResult = loginRequestSchema.safeParse(req.body);

      if (!parseResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the login fields and try again."
        );
      }

      const result = await service.login(parseResult.data);

      res.cookie(
        env.SESSION_COOKIE_NAME,
        result.sessionToken,
        sessionCookieOptions
      );
      res.status(200).json({
        user: result.user
      });
    } catch (error) {
      next(error);
    }
  },

  logout: (_req, res) => {
    res.clearCookie(env.SESSION_COOKIE_NAME, clearedSessionCookieOptions);
    res.status(204).send();
  },

  me: (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      res.status(200).json({
        user: req.currentUser
      });
    } catch (error) {
      next(error);
    }
  }
});

export const authController = createAuthController();
