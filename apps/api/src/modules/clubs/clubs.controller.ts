import type { RequestHandler } from "express";

import { HttpError } from "../../core/errors/http-error.js";
import "../auth/auth.request.js";
import { listClubsQuerySchema } from "./clubs.schema.js";
import { clubsService, type ClubsService } from "./clubs.service.js";

export type ClubsController = {
  listClubs: RequestHandler;
};

export const createClubsController = (
  service: ClubsService = clubsService
): ClubsController => ({
  listClubs: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const parseResult = listClubsQuerySchema.safeParse(req.query);

      if (!parseResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the club discovery query and try again."
        );
      }

      const response = await service.listPublicClubs(parseResult.data);

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
});

export const clubsController = createClubsController();
