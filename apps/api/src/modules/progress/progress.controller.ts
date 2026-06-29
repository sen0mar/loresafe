import type { RequestHandler } from "express";

import { HttpError } from "../../core/errors/http-error.js";
import "../auth/auth.request.js";
import { clubLinkNameParamsSchema } from "../clubs/clubs.schema.js";
import {
  progressService,
  type ProgressService
} from "./progress.service.js";
import {
  recentlyUnlockedQuerySchema,
  updateProgressRequestSchema
} from "./progress.schema.js";

export type ProgressController = {
  advanceProgressToNextMilestoneForClubLinkName: RequestHandler;
  getProgressForClubLinkName: RequestHandler;
  listRecentlyUnlockedForClubLinkName: RequestHandler;
  updateProgressForClubLinkName: RequestHandler;
};

export const createProgressController = (
  service: ProgressService = progressService
): ProgressController => ({
  advanceProgressToNextMilestoneForClubLinkName: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const paramsResult = clubLinkNameParamsSchema.safeParse(req.params);

      if (!paramsResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the club URL and try again."
        );
      }

      const response =
        await service.advanceProgressToNextMilestoneForClubLinkName(
          paramsResult.data.linkName,
          req.currentUser.id
        );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  getProgressForClubLinkName: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const paramsResult = clubLinkNameParamsSchema.safeParse(req.params);

      if (!paramsResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the club URL and try again."
        );
      }

      const response = await service.getProgressForClubLinkName(
        paramsResult.data.linkName,
        req.currentUser.id
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  listRecentlyUnlockedForClubLinkName: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const paramsResult = clubLinkNameParamsSchema.safeParse(req.params);
      const queryResult = recentlyUnlockedQuerySchema.safeParse(req.query);

      if (!paramsResult.success || !queryResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the recently unlocked request and try again."
        );
      }

      const response = await service.listRecentlyUnlockedForClubLinkName(
        paramsResult.data.linkName,
        req.currentUser.id,
        queryResult.data
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  updateProgressForClubLinkName: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const paramsResult = clubLinkNameParamsSchema.safeParse(req.params);

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

      const response = await service.updateProgressForClubLinkName(
        paramsResult.data.linkName,
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
