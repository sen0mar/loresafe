import type { RequestHandler } from "express";

import { HttpError } from "../../core/errors/http-error.js";
import { updateCurrentUserProfileRequestSchema } from "./users.schema.js";
import { usersService, type UsersService } from "./users.service.js";
import "../auth/auth.request.js";

export type UsersController = {
  updateMe: RequestHandler;
};

export const createUsersController = (
  service: UsersService = usersService
): UsersController => ({
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
