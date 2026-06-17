import { Router } from "express";

import { authMiddleware, type AuthMiddleware } from "../auth/auth.middleware.js";
import {
  dashboardController,
  type DashboardController
} from "./dashboard.controller.js";

export const createDashboardRouter = (
  controller: DashboardController = dashboardController,
  middleware: AuthMiddleware = authMiddleware
) => {
  const router = Router();

  router.get(
    "/:slug/stats",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.getClubStats
  );

  router.get(
    "/:slug/popular-discussions",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.getPopularDiscussions
  );

  router.get(
    "/:slug/progress/summary",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.getProgressSummary
  );

  router.get(
    "/:slug/recently-unlocked/summary",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.getRecentlyUnlockedSummary
  );

  return router;
};

export const dashboardRouter = createDashboardRouter();
