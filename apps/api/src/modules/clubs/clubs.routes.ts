import { Router } from "express";

import { authMiddleware, type AuthMiddleware } from "../auth/auth.middleware.js";
import { clubsController, type ClubsController } from "./clubs.controller.js";

export const createClubsRouter = (
  controller: ClubsController = clubsController,
  middleware: AuthMiddleware = authMiddleware
) => {
  const router = Router();

  router.get(
    "/",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.listClubs
  );

  return router;
};

export const clubsRouter = createClubsRouter();
