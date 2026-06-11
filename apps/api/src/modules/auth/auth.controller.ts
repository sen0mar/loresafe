import type { RequestHandler } from "express";

import { env } from "../../config/env.js";
import { HttpError } from "../../core/errors/http-error.js";
import { sessionCookieOptions } from "../../core/security/session-token.js";
import { authService, type AuthService } from "./auth.service.js";
import { signupRequestSchema } from "./auth.schema.js";

export type AuthController = {
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
  }
});

export const authController = createAuthController();
