import { Router } from "express";

import { authMiddleware, type AuthMiddleware } from "../auth/auth.middleware.js";
import {
  milestonesController,
  type MilestonesController
} from "./milestones.controller.js";

export const createMilestonesRouter = (
  controller: MilestonesController = milestonesController,
  middleware: AuthMiddleware = authMiddleware
) => {
  const router = Router();

  router.post(
    "/:slug/milestones/templates",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.createMilestoneTemplateForClubSlug
  );

  router.post(
    "/:slug/milestones",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.createMilestoneForClubSlug
  );

  router.patch(
    "/:slug/milestones/:milestoneId",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.updateMilestoneForClubSlug
  );

  router.post(
    "/:slug/milestones/:milestoneId/move",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.moveMilestoneForClubSlug
  );

  router.get(
    "/:slug/milestones",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.listMilestonesByClubSlug
  );

  return router;
};

export const milestonesRouter = createMilestonesRouter();
