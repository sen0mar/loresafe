import type { RequestHandler } from "express";

import { HttpError } from "../../core/errors/http-error.js";
import "../auth/auth.request.js";
import {
  clubModerationReportsParamsSchema,
  createReportRequestSchema,
  listModerationReportsQuerySchema,
  moderationReportActionParamsSchema,
  moderationReportBanRequestSchema,
  moderationReportNoteRequestSchema,
  moderationReportRevealParamsSchema,
  moderationReportRequiredMilestoneRequestSchema,
  moderationReportResolveRequestSchema
} from "./reports.schema.js";
import { reportsService, type ReportsService } from "./reports.service.js";

export type ReportsController = {
  createReport: RequestHandler;
  listModerationReportsForClub: RequestHandler;
  revealModerationReportForClub: RequestHandler;
  updateReportRequiredMilestoneForClub: RequestHandler;
  hideReportedContentForClub: RequestHandler;
  deleteReportedContentForClub: RequestHandler;
  warnReportedContentAuthorForClub: RequestHandler;
  banReportedContentAuthorForClub: RequestHandler;
  resolveModerationReportForClub: RequestHandler;
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
        paramsResult.data.linkName,
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
        paramsResult.data.linkName,
        paramsResult.data.reportId,
        req.currentUser.id
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  updateReportRequiredMilestoneForClub: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const paramsResult = moderationReportActionParamsSchema.safeParse(
        req.params
      );
      const bodyResult =
        moderationReportRequiredMilestoneRequestSchema.safeParse(req.body);

      if (!paramsResult.success || !bodyResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the moderation action request and try again."
        );
      }

      const response = await service.updateReportRequiredMilestoneForClub(
        paramsResult.data.linkName,
        paramsResult.data.reportId,
        req.currentUser.id,
        bodyResult.data
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  hideReportedContentForClub: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const paramsResult = moderationReportActionParamsSchema.safeParse(
        req.params
      );
      const bodyResult = moderationReportNoteRequestSchema.safeParse(req.body);

      if (!paramsResult.success || !bodyResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the moderation action request and try again."
        );
      }

      const response = await service.hideReportedContentForClub(
        paramsResult.data.linkName,
        paramsResult.data.reportId,
        req.currentUser.id,
        bodyResult.data
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  deleteReportedContentForClub: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const paramsResult = moderationReportActionParamsSchema.safeParse(
        req.params
      );
      const bodyResult = moderationReportNoteRequestSchema.safeParse(req.body);

      if (!paramsResult.success || !bodyResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the moderation action request and try again."
        );
      }

      const response = await service.deleteReportedContentForClub(
        paramsResult.data.linkName,
        paramsResult.data.reportId,
        req.currentUser.id,
        bodyResult.data
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  warnReportedContentAuthorForClub: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const paramsResult = moderationReportActionParamsSchema.safeParse(
        req.params
      );
      const bodyResult = moderationReportNoteRequestSchema.safeParse(req.body);

      if (!paramsResult.success || !bodyResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the moderation action request and try again."
        );
      }

      const response = await service.warnReportedContentAuthorForClub(
        paramsResult.data.linkName,
        paramsResult.data.reportId,
        req.currentUser.id,
        bodyResult.data
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  banReportedContentAuthorForClub: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const paramsResult = moderationReportActionParamsSchema.safeParse(
        req.params
      );
      const bodyResult = moderationReportBanRequestSchema.safeParse(req.body);

      if (!paramsResult.success || !bodyResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the moderation action request and try again."
        );
      }

      const response = await service.banReportedContentAuthorForClub(
        paramsResult.data.linkName,
        paramsResult.data.reportId,
        req.currentUser.id,
        bodyResult.data
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  resolveModerationReportForClub: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const paramsResult = moderationReportActionParamsSchema.safeParse(
        req.params
      );
      const bodyResult = moderationReportResolveRequestSchema.safeParse(
        req.body
      );

      if (!paramsResult.success || !bodyResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the moderation action request and try again."
        );
      }

      const response = await service.resolveModerationReportForClub(
        paramsResult.data.linkName,
        paramsResult.data.reportId,
        req.currentUser.id,
        bodyResult.data
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
});

export const reportsController = createReportsController();
