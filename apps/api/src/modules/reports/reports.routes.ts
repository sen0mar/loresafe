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
    "/:linkName/moderation/reports",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.listModerationReportsForClub
  );

  router.post(
    "/:linkName/moderation/reports/:reportId/reveal",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.revealModerationReportForClub
  );

  router.patch(
    "/:linkName/moderation/reports/:reportId/required-milestone",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.updateReportRequiredMilestoneForClub
  );

  router.post(
    "/:linkName/moderation/reports/:reportId/hide",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.hideReportedContentForClub
  );

  router.post(
    "/:linkName/moderation/reports/:reportId/delete",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.deleteReportedContentForClub
  );

  router.post(
    "/:linkName/moderation/reports/:reportId/warn",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.warnReportedContentAuthorForClub
  );

  router.post(
    "/:linkName/moderation/reports/:reportId/ban",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.banReportedContentAuthorForClub
  );

  router.patch(
    "/:linkName/moderation/reports/:reportId/resolve",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.resolveModerationReportForClub
  );

  return router;
};

export const reportsRouter = createReportsRouter();
export const clubReportsRouter = createClubReportsRouter();
