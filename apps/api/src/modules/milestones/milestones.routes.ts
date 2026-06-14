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

  router.get(
    "/:slug/milestones",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.listMilestonesByClubSlug
  );

  return router;
};

export const milestonesRouter = createMilestonesRouter();
