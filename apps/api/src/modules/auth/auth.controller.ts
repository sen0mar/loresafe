import type { RequestHandler } from "express";
import type { ZodType } from "zod";

import { env } from "../../config/env.js";
import { HttpError } from "../../core/errors/http-error.js";
import {
  clearedSessionCookieOptions,
  clearedRefreshSessionCookieOptions,
  refreshSessionCookieName,
  refreshSessionCookieOptions,
  sessionCookieOptions
} from "../../core/security/session-token.js";
import {
  authService,
  RefreshTokenReuseError,
  type AuthService
} from "./auth.service.js";
import {
  forgotPasswordRequestSchema,
  loginRequestSchema,
  resendVerificationRequestSchema,
  resetPasswordRequestSchema,
  signupRequestSchema,
  verifyEmailRequestSchema
} from "./auth.schema.js";
import "./auth.request.js";
import { eventsService, type EventsService } from "../events/events.service.js";

export type AuthController = {
  login: RequestHandler;
  logout: RequestHandler;
  logoutAll: RequestHandler;
  me: RequestHandler;
  refresh: RequestHandler;
  signup: RequestHandler;
  resendVerification: RequestHandler;
  verifyEmail: RequestHandler;
  forgotPassword: RequestHandler;
  resetPassword: RequestHandler;
};

export const createAuthController = (
  service: AuthService = authService,
  eventPublisher: Pick<EventsService, "disconnectUser"> = eventsService
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

      await service.signup(parseResult.data);
      res.status(202).json(neutralEmailResponse);
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
      res.cookie(
        refreshSessionCookieName,
        result.refreshToken,
        refreshSessionCookieOptions
      );
      res.status(200).json({
        user: result.user
      });
    } catch (error) {
      next(error);
    }
  },

  logout: async (req, res, next) => {
    try {
      const revokedUserId = await service.revokeSession({
        sessionToken: getCookie(req.cookies, env.SESSION_COOKIE_NAME),
        refreshToken: getCookie(req.cookies, refreshSessionCookieName)
      });

      const disconnectedUserId = revokedUserId ?? req.currentUser?.id;

      if (disconnectedUserId) {
        await eventPublisher.disconnectUser(disconnectedUserId);
      }

      res.clearCookie(env.SESSION_COOKIE_NAME, clearedSessionCookieOptions);
      res.clearCookie(
        refreshSessionCookieName,
        clearedRefreshSessionCookieOptions
      );
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  logoutAll: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      await service.revokeAllSessions(req.currentUser.id);
      await eventPublisher.disconnectUser(req.currentUser.id);
      res.clearCookie(env.SESSION_COOKIE_NAME, clearedSessionCookieOptions);
      res.clearCookie(
        refreshSessionCookieName,
        clearedRefreshSessionCookieOptions
      );
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  refresh: async (req, res, next) => {
    try {
      const result = await service.refresh(
        getCookie(req.cookies, refreshSessionCookieName)
      );

      res.cookie(
        env.SESSION_COOKIE_NAME,
        result.sessionToken,
        sessionCookieOptions
      );
      res.cookie(
        refreshSessionCookieName,
        result.refreshToken,
        refreshSessionCookieOptions
      );
      res.status(200).json({ user: result.user });
    } catch (error) {
      if (error instanceof RefreshTokenReuseError) {
        await eventPublisher.disconnectUser(error.userId);
      }

      res.clearCookie(env.SESSION_COOKIE_NAME, clearedSessionCookieOptions);
      res.clearCookie(
        refreshSessionCookieName,
        clearedRefreshSessionCookieOptions
      );
      next(error);
    }
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
  },

  resendVerification: async (req, res, next) => {
    try {
      const input = parseIdentityRequest(
        resendVerificationRequestSchema,
        req.body
      );
      await service.resendVerification(input);
      res.status(202).json(neutralEmailResponse);
    } catch (error) {
      next(error);
    }
  },

  verifyEmail: async (req, res, next) => {
    try {
      const input = parseIdentityRequest(verifyEmailRequestSchema, req.body);
      await service.verifyEmail(input);
      res.status(200).json(completedResponse);
    } catch (error) {
      next(error);
    }
  },

  forgotPassword: async (req, res, next) => {
    try {
      const input = parseIdentityRequest(forgotPasswordRequestSchema, req.body);
      await service.forgotPassword(input);
      res.status(202).json(neutralEmailResponse);
    } catch (error) {
      next(error);
    }
  },

  resetPassword: async (req, res, next) => {
    try {
      const input = parseIdentityRequest(resetPasswordRequestSchema, req.body);
      const userId = await service.resetPassword(input);

      if (userId) {
        await eventPublisher.disconnectUser(userId);
      }

      res.clearCookie(env.SESSION_COOKIE_NAME, clearedSessionCookieOptions);
      res.clearCookie(
        refreshSessionCookieName,
        clearedRefreshSessionCookieOptions
      );
      res.status(200).json(completedResponse);
    } catch (error) {
      next(error);
    }
  }
});

export const authController = createAuthController();

const getCookie = (cookies: unknown, name: string) => {
  if (!cookies || typeof cookies !== "object") {
    return undefined;
  }

  const value = (cookies as Record<string, unknown>)[name];

  return typeof value === "string" ? value : undefined;
};

const neutralEmailResponse = {
  message: "If the account is eligible, an email has been sent."
} as const;

const completedResponse = {
  message: "Request completed."
} as const;

const parseIdentityRequest = <Output>(
  schema: ZodType<Output>,
  body: unknown
) => {
  const result = schema.safeParse(body);

  if (!result.success) {
    throw new HttpError(400, "BAD_REQUEST", "Check the fields and try again.");
  }

  return result.data;
};
