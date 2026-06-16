import { Router } from "express";

import { authMiddleware, type AuthMiddleware } from "../auth/auth.middleware.js";
import {
  progressController,
  type ProgressController
} from "./progress.controller.js";

export const createProgressRouter = (
  controller: ProgressController = progressController,
  middleware: AuthMiddleware = authMiddleware
) => {
  const router = Router();

  router.get(
    "/:slug/progress",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.getProgressForClubSlug
  );

  router.get(
    "/:slug/recently-unlocked",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.listRecentlyUnlockedForClubSlug
  );

  router.patch(
    "/:slug/progress",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.updateProgressForClubSlug
  );

  router.post(
    "/:slug/progress/next",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.advanceProgressToNextMilestoneForClubSlug
  );

  return router;
};

export const progressRouter = createProgressRouter();
