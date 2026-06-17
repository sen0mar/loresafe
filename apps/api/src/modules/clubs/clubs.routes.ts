import { Router } from "express";

import { authMiddleware, type AuthMiddleware } from "../auth/auth.middleware.js";
import { clubsController, type ClubsController } from "./clubs.controller.js";

export const createClubsRouter = (
  controller: ClubsController = clubsController,
  middleware: AuthMiddleware = authMiddleware
) => {
  const router = Router();

  router.post(
    "/",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.createClub
  );

  router.get(
    "/",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.listClubs
  );

  router.post(
    "/:slug/join",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.joinPublicClubBySlug
  );

  router.get(
    "/:slug/members",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.listClubMembers
  );

  router.patch(
    "/:slug/members/:membershipId/role",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.updateClubMemberRole
  );

  router.post(
    "/:slug/members/:membershipId/ban",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.banClubMember
  );

  router.post(
    "/:slug/members/:membershipId/unban",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.unbanClubMember
  );

  router.get(
    "/:slug",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.getClubBySlug
  );

  return router;
};

export const clubsRouter = createClubsRouter();
