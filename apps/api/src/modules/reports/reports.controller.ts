import type { RequestHandler } from "express";

import { HttpError } from "../../core/errors/http-error.js";
import "../auth/auth.request.js";
import {
  clubModerationReportsParamsSchema,
  createReportRequestSchema,
  listModerationReportsQuerySchema,
  moderationReportRevealParamsSchema
} from "./reports.schema.js";
import { reportsService, type ReportsService } from "./reports.service.js";

export type ReportsController = {
  createReport: RequestHandler;
  listModerationReportsForClub: RequestHandler;
  revealModerationReportForClub: RequestHandler;
};

export const createReportsController = (
  service: ReportsService = reportsService
): ReportsController => ({
  createReport: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const bodyResult = createReportRequestSchema.safeParse(req.body);

      if (!bodyResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the report details and try again."
        );
      }

      const response = await service.createReport(
        req.currentUser.id,
        bodyResult.data
      );

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  },

  listModerationReportsForClub: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const paramsResult = clubModerationReportsParamsSchema.safeParse(
        req.params
      );
      const queryResult = listModerationReportsQuerySchema.safeParse(req.query);

      if (!paramsResult.success || !queryResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the moderation reports request and try again."
        );
      }

      const response = await service.listModerationReportsForClub(
        paramsResult.data.slug,
        req.currentUser.id,
        queryResult.data
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  revealModerationReportForClub: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const paramsResult = moderationReportRevealParamsSchema.safeParse(
        req.params
      );

      if (!paramsResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the moderation report request and try again."
        );
      }

      const response = await service.revealModerationReportForClub(
        paramsResult.data.slug,
        paramsResult.data.reportId,
        req.currentUser.id
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
});

export const reportsController = createReportsController();
