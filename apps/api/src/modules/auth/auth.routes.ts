import { Router } from "express";

import { authController, type AuthController } from "./auth.controller.js";
import { authMiddleware, type AuthMiddleware } from "./auth.middleware.js";

export const createAuthRouter = (
  controller: AuthController = authController,
  middleware: AuthMiddleware = authMiddleware
) => {
  const router = Router();

  router.get(
    "/me",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.me
  );
  router.post("/login", controller.login);
  router.post("/logout", middleware.loadCurrentUser, controller.logout);
  router.post(
    "/logout-all",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.logoutAll
  );
  router.post("/refresh", controller.refresh);
  router.post("/signup", controller.signup);

  return router;
};

export const authRouter = createAuthRouter();
