import { Router } from "express";

import {
  authMiddleware,
  type AuthMiddleware
} from "../auth/auth.middleware.js";
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
    "/:linkName/milestones/templates",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.createMilestoneTemplateForClubLinkName
  );

  router.post(
    "/:linkName/milestones",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.createMilestoneForClubLinkName
  );

  router.patch(
    "/:linkName/milestones/:milestoneId",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.updateMilestoneForClubLinkName
  );

  router.post(
    "/:linkName/milestones/:milestoneId/move",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.moveMilestoneForClubLinkName
  );

  router.get(
    "/:linkName/milestones",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.listMilestonesByClubLinkName
  );

  return router;
};

export const milestonesRouter = createMilestonesRouter();
