import type { RequestHandler } from "express";

import { HttpError } from "../../core/errors/http-error.js";
import "../auth/auth.request.js";
import { clubSlugParamsSchema } from "../clubs/clubs.schema.js";
import {
  progressService,
  type ProgressService
} from "./progress.service.js";
import { updateProgressRequestSchema } from "./progress.schema.js";

export type ProgressController = {
  advanceProgressToNextMilestoneForClubSlug: RequestHandler;
  getProgressForClubSlug: RequestHandler;
  updateProgressForClubSlug: RequestHandler;
};

export const createProgressController = (
  service: ProgressService = progressService
): ProgressController => ({
  advanceProgressToNextMilestoneForClubSlug: async (req, res, next) => {
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

      const response =
        await service.advanceProgressToNextMilestoneForClubSlug(
          paramsResult.data.slug,
          req.currentUser.id
        );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  getProgressForClubSlug: async (req, res, next) => {
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

      const response = await service.getProgressForClubSlug(
        paramsResult.data.slug,
        req.currentUser.id
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  updateProgressForClubSlug: async (req, res, next) => {
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

      const bodyResult = updateProgressRequestSchema.safeParse(req.body);

      if (!bodyResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the progress update and try again."
        );
      }

      const response = await service.updateProgressForClubSlug(
        paramsResult.data.slug,
        req.currentUser.id,
        bodyResult.data
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
});

export const progressController = createProgressController();
