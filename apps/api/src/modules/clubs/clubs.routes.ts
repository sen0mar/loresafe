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

  router.post(
    "/:linkName/leave",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.leaveClubByLinkName
  );

  router.get(
    "/:linkName/members",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.listClubMembers
  );

  router.get(
    "/:linkName/bans",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.listClubBans
  );

  router.patch(
    "/:linkName/members/:membershipId/role",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.updateClubMemberRole
  );

  router.patch(
    "/:linkName/settings",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.updateClubSettings
  );

  router.post(
    "/:linkName/members/:membershipId/ban",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.banClubMember
  );

  router.post(
    "/:linkName/bans/:banId/unban",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.unbanClubBan
  );

  router.get(
    "/:linkName",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.getClubByLinkName
  );

  return router;
};

export const createPublicClubsRouter = (
  controller: ClubsController = clubsController,
  middleware: AuthMiddleware = authMiddleware
) => {
  const router = Router();

  router.get("/", middleware.loadCurrentUser, controller.listPublicSeoClubs);
  router.get(
    "/:linkName",
    middleware.loadCurrentUser,
    controller.getPublicSeoClubByLinkName
  );

  return router;
};

export const clubsRouter = createClubsRouter();
export const publicClubsRouter = createPublicClubsRouter();
