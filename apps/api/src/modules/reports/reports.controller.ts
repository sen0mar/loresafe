import type { RequestHandler } from "express";

import { HttpError } from "../../core/errors/http-error.js";
import "../auth/auth.request.js";
import { createReportRequestSchema } from "./reports.schema.js";
import { reportsService, type ReportsService } from "./reports.service.js";

export type ReportsController = {
  createReport: RequestHandler;
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
  }
});

export const reportsController = createReportsController();
