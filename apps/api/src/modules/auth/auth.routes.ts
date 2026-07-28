import { Router } from "express";
import rateLimit from "express-rate-limit";

import { HttpError } from "../../core/errors/http-error.js";
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
  router.post(
    "/verification/confirm",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 20,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      handler: (_req, _res, next) => {
        next(
          new HttpError(
            429,
            "TOO_MANY_REQUESTS",
            "Too many attempts. Try again later."
          )
        );
      }
    }),
    controller.verifyEmail
  );
  router.post("/password/forgot", controller.forgotPassword);
  router.post("/password/reset", controller.resetPassword);

  return router;
};

export const authRouter = createAuthRouter();
