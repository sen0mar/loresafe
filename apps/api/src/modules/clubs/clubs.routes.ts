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
    "/:linkName/join",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.joinPublicClubByLinkName
  );

  router.get(
    "/:linkName/members",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.listClubMembers
  );

  router.patch(
    "/:linkName/members/:membershipId/role",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.updateClubMemberRole
  );

  router.post(
    "/:linkName/members/:membershipId/ban",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.banClubMember
  );

  router.post(
    "/:linkName/members/:membershipId/unban",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.unbanClubMember
  );

  router.get(
    "/:linkName",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.getClubByLinkName
  );

  return router;
};

export const clubsRouter = createClubsRouter();
