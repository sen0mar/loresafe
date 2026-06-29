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
    "/:linkName/progress",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.getProgressForClubLinkName
  );

  router.get(
    "/:linkName/recently-unlocked",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.listRecentlyUnlockedForClubLinkName
  );

  router.patch(
    "/:linkName/progress",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.updateProgressForClubLinkName
  );

  router.post(
    "/:linkName/progress/next",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.advanceProgressToNextMilestoneForClubLinkName
  );

  return router;
};

export const progressRouter = createProgressRouter();
