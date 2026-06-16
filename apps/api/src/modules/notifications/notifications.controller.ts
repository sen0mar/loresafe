import type { RequestHandler } from "express";

import { HttpError } from "../../core/errors/http-error.js";
import "../auth/auth.request.js";
import {
  listNotificationsQuerySchema,
  notificationParamsSchema
} from "./notifications.schema.js";
import {
  notificationsService,
  type NotificationsService
} from "./notifications.service.js";

export type NotificationsController = {
  listNotifications: RequestHandler;
  markNotificationRead: RequestHandler;
};

export const createNotificationsController = (
  service: NotificationsService = notificationsService
): NotificationsController => ({
  listNotifications: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const queryResult = listNotificationsQuerySchema.safeParse(req.query);

      if (!queryResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the notifications request and try again."
        );
      }

      const response = await service.listNotifications(
        req.currentUser.id,
        queryResult.data
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  markNotificationRead: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const paramsResult = notificationParamsSchema.safeParse(req.params);

      if (!paramsResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the notification request and try again."
        );
      }

      const response = await service.markNotificationRead(
        paramsResult.data.id,
        req.currentUser.id
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
});

export const notificationsController = createNotificationsController();
