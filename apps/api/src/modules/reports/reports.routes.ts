import { Router } from "express";

import { authMiddleware, type AuthMiddleware } from "../auth/auth.middleware.js";
import {
  reportsController,
  type ReportsController
} from "./reports.controller.js";

export const createReportsRouter = (
  controller: ReportsController = reportsController,
  middleware: AuthMiddleware = authMiddleware
) => {
  const router = Router();

  router.post(
    "/",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.createReport
  );

  return router;
};

export const createClubReportsRouter = (
  controller: ReportsController = reportsController,
  middleware: AuthMiddleware = authMiddleware
) => {
  const router = Router();

  router.get(
    "/:slug/moderation/reports",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.listModerationReportsForClub
  );

  router.post(
    "/:slug/moderation/reports/:reportId/reveal",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.revealModerationReportForClub
  );

  return router;
};

export const reportsRouter = createReportsRouter();
export const clubReportsRouter = createClubReportsRouter();
