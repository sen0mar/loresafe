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
  router.post("/logout", controller.logout);
  router.post("/signup", controller.signup);

  return router;
};

export const authRouter = createAuthRouter();
