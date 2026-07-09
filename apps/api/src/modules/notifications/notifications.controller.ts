import type { RequestHandler } from "express";

import { HttpError } from "../../core/errors/http-error.js";
import "../auth/auth.request.js";
import {
  deleteSelectedNotificationsBodySchema,
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
  markAllNotificationsRead: RequestHandler;
  deleteNotification: RequestHandler;
  deleteSelectedNotifications: RequestHandler;
  deleteAllNotifications: RequestHandler;
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
  },

  markAllNotificationsRead: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const response = await service.markAllNotificationsRead(
        req.currentUser.id
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  deleteNotification: async (req, res, next) => {
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

      const response = await service.deleteNotification(
        paramsResult.data.id,
        req.currentUser.id
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  deleteSelectedNotifications: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const bodyResult = deleteSelectedNotificationsBodySchema.safeParse(
        req.body
      );

      if (!bodyResult.success) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          "Check the notification request and try again."
        );
      }

      const response = await service.deleteSelectedNotifications(
        bodyResult.data.notificationIds,
        req.currentUser.id
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  deleteAllNotifications: async (req, res, next) => {
    try {
      if (!req.currentUser) {
        throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
      }

      const response = await service.deleteAllNotifications(req.currentUser.id);

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
});

export const notificationsController = createNotificationsController();
