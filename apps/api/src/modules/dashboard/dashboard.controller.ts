import type { RequestHandler } from "express";

import { HttpError } from "../../core/errors/http-error.js";
import "../auth/auth.request.js";
import { clubSlugParamsSchema } from "../clubs/clubs.schema.js";
import {
  dashboardService,
  type DashboardService
} from "./dashboard.service.js";
import {
  popularDiscussionsQuerySchema,
  recentlyUnlockedSummaryQuerySchema
} from "./dashboard.schema.js";

export type DashboardController = {
  getClubStats: RequestHandler;
  getPopularDiscussions: RequestHandler;
  getProgressSummary: RequestHandler;
  getRecentlyUnlockedSummary: RequestHandler;
};

export const createDashboardController = (
  service: DashboardService = dashboardService
): DashboardController => ({
  getClubStats: async (req, res, next) => {
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

      const response = await service.getClubStats(
        paramsResult.data.slug,
        req.currentUser.id
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  getPopularDiscussions: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const paramsResult = clubSlugParamsSchema.safeParse(req.params);
      const queryResult = popularDiscussionsQuerySchema.safeParse(req.query);

      if (!paramsResult.success || !queryResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the popular discussions request and try again."
        );
      }

      const response = await service.getPopularDiscussions(
        paramsResult.data.slug,
        req.currentUser.id,
        queryResult.data
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  getProgressSummary: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const paramsResult = clubSlugParamsSchema.safeParse(req.params);

      if (!paramsResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the progress summary request and try again."
        );
      }

      const response = await service.getProgressSummary(
        paramsResult.data.slug,
        req.currentUser.id
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  getRecentlyUnlockedSummary: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const paramsResult = clubSlugParamsSchema.safeParse(req.params);
      const queryResult = recentlyUnlockedSummaryQuerySchema.safeParse(
        req.query
      );

      if (!paramsResult.success || !queryResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the recently unlocked summary request and try again."
        );
      }

      const response = await service.getRecentlyUnlockedSummary(
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

export const dashboardController = createDashboardController();
