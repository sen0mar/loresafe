import { Router } from "express";

import { authController, type AuthController } from "./auth.controller.js";

export const createAuthRouter = (
  controller: AuthController = authController
) => {
  const router = Router();

  router.post("/signup", controller.signup);

  return router;
};

export const authRouter = createAuthRouter();
