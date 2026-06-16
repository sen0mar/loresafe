import { Router } from "express";

import { authMiddleware, type AuthMiddleware } from "../auth/auth.middleware.js";
import {
  notificationsController,
  type NotificationsController
} from "./notifications.controller.js";

export const createNotificationsRouter = (
  controller: NotificationsController = notificationsController,
  middleware: AuthMiddleware = authMiddleware
) => {
  const router = Router();

  router.get(
    "/",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.listNotifications
  );

  router.post(
    "/:id/read",
    middleware.loadCurrentUser,
    middleware.requireUser,
    controller.markNotificationRead
  );

  return router;
};

export const notificationsRouter = createNotificationsRouter();
