import { Router } from "express";

import { authMiddleware, type AuthMiddleware } from "../auth/auth.middleware.js";
import {
  reportsController,
  type ReportsController
} from "./reports.controller.js";

export const createReportsRouter = (
  controller: ReportsController = reportsController,
  middleware: AuthMiddleware = authMiddleware
) => {
  const router = Router();

  router.post(
    "/",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.createReport
  );

  return router;
};

export const reportsRouter = createReportsRouter();
