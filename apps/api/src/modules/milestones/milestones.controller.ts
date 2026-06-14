import type { RequestHandler } from "express";

import { HttpError } from "../../core/errors/http-error.js";
import "../auth/auth.request.js";
import { clubSlugParamsSchema } from "../clubs/clubs.schema.js";
import {
  createMilestoneRequestSchema,
  listMilestonesQuerySchema
} from "./milestones.schema.js";
import {
  milestonesService,
  type MilestonesService
} from "./milestones.service.js";

export type MilestonesController = {
  createMilestoneForClubSlug: RequestHandler;
  listMilestonesByClubSlug: RequestHandler;
};

export const createMilestonesController = (
  service: MilestonesService = milestonesService
): MilestonesController => ({
  createMilestoneForClubSlug: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const paramsResult = clubSlugParamsSchema.safeParse(req.params);

      if (!paramsResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the club URL and try again."
        );
      }

      const bodyResult = createMilestoneRequestSchema.safeParse(req.body);

      if (!bodyResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the milestone details and try again."
        );
      }

      const response = await service.createMilestoneForClubSlug(
        paramsResult.data.slug,
        req.currentUser.id,
        bodyResult.data
      );

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  },

  listMilestonesByClubSlug: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const paramsResult = clubSlugParamsSchema.safeParse(req.params);

      if (!paramsResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the club URL and try again."
        );
      }

      const queryResult = listMilestonesQuerySchema.safeParse(req.query);

      if (!queryResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the milestone query and try again."
        );
      }

      const response = await service.listMilestonesByClubSlug(
        paramsResult.data.slug,
        req.currentUser.id,
        queryResult.data
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
});

export const milestonesController = createMilestonesController();
