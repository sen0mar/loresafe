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

  router.get(
    "/:slug",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.getClubBySlug
  );

  return router;
};

export const clubsRouter = createClubsRouter();
