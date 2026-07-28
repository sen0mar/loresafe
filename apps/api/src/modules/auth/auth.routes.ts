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
  router.post("/verification/resend", controller.resendVerification);
  router.post("/verification/confirm", controller.verifyEmail);
  router.post("/password/forgot", controller.forgotPassword);
  router.post("/password/reset", controller.resetPassword);

  return router;
};

export const authRouter = createAuthRouter();
