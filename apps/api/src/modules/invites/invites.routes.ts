import { Router } from "express";

import { authMiddleware, type AuthMiddleware } from "../auth/auth.middleware.js";
import {
  invitesController,
  type InvitesController
} from "./invites.controller.js";

export const createClubInvitesRouter = (
  controller: InvitesController = invitesController,
  middleware: AuthMiddleware = authMiddleware
) => {
  const router = Router();

  router.post(
    "/:slug/invites",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.createClubInvite
  );

  return router;
};

export const createInvitesRouter = (
  controller: InvitesController = invitesController,
  middleware: AuthMiddleware = authMiddleware
) => {
  const router = Router();

  router.post(
    "/:token/accept",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.acceptInvite
  );

  return router;
};

export const clubInvitesRouter = createClubInvitesRouter();
export const invitesRouter = createInvitesRouter();
