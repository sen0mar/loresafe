import { Router } from "express";

import {
  authMiddleware,
  type AuthMiddleware
} from "../auth/auth.middleware.js";
import { usersController, type UsersController } from "./users.controller.js";

export const createUsersRouter = (
  controller: UsersController = usersController,
  middleware: AuthMiddleware = authMiddleware
) => {
  const router = Router();

  router.delete(
    "/me",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.deleteMe
  );

  router.get(
    "/me/clubs",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.listCurrentUserClubs
  );

  router.patch(
    "/me",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.updateMe
  );

  return router;
};

export const usersRouter = createUsersRouter();
