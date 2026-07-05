import type { RequestHandler } from "express";

import { env } from "../../config/env.js";
import { HttpError } from "../../core/errors/http-error.js";
import { clearedSessionCookieOptions } from "../../core/security/session-token.js";
import {
  deleteCurrentUserAccountRequestSchema,
  listCurrentUserClubsQuerySchema,
  updateCurrentUserProfileRequestSchema
} from "./users.schema.js";
import { usersService, type UsersService } from "./users.service.js";
import "../auth/auth.request.js";

export type UsersController = {
  deleteMe: RequestHandler;
  listCurrentUserClubs: RequestHandler;
  updateMe: RequestHandler;
};

export const createUsersController = (
  service: UsersService = usersService
): UsersController => ({
  deleteMe: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const parseResult = deleteCurrentUserAccountRequestSchema.safeParse(
        req.body
      );

      if (!parseResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          'Type "delete" to confirm account deletion.'
        );
      }

      await service.deleteCurrentUserAccount(
        req.currentUser.id,
        parseResult.data
      );

      res.clearCookie(env.SESSION_COOKIE_NAME, clearedSessionCookieOptions);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  listCurrentUserClubs: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const parseResult = listCurrentUserClubsQuerySchema.safeParse(req.query);

      if (!parseResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the joined clubs query and try again."
        );
      }

      const response = await service.listCurrentUserClubs(
        req.currentUser.id,
        parseResult.data
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  updateMe: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const parseResult = updateCurrentUserProfileRequestSchema.safeParse(
        req.body
      );

      if (!parseResult.success) {
        const message =
          Object.keys(req.body ?? {}).length === 0
            ? "Send at least one profile field to update."
            : "Check the profile fields and try again.";

        throw new HttpError(400, "BAD_REQUEST", message);
      }

      const user = await service.updateCurrentUserProfile(
        req.currentUser.id,
        parseResult.data
      );

      res.status(200).json({
        user
      });
    } catch (error) {
      next(error);
    }
  }
});

export const usersController = createUsersController();
