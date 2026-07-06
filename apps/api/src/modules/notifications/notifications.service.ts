import { HttpError } from "../../core/errors/http-error.js";
import {
  eventsService,
  type EventsService
} from "../events/events.service.js";
import {
  type DeleteNotificationResponse,
  type MarkAllNotificationsReadResponse,
  type MarkNotificationReadResponse,
  type NotificationsResponse,
  toNotificationDto
} from "./notifications.dto.js";
import {
  type ListNotificationsInput,
  type NotificationsCursor,
  notificationsRepository,
  type NotificationsRepository
} from "./notifications.repository.js";
import type { ListNotificationsQuery } from "./notifications.schema.js";

export type NotificationsService = {
  listNotifications: (
    userId: string,
    query: ListNotificationsQuery
  ) => Promise<NotificationsResponse>;
  markNotificationRead: (
    notificationId: string,
    userId: string
  ) => Promise<MarkNotificationReadResponse>;
  markAllNotificationsRead: (
    userId: string
  ) => Promise<MarkAllNotificationsReadResponse>;
  deleteNotification: (
    notificationId: string,
    userId: string
  ) => Promise<DeleteNotificationResponse>;
  deleteAllNotifications: (
    userId: string
  ) => Promise<DeleteNotificationResponse>;
};

export const createNotificationsService = (
  repository: NotificationsRepository = notificationsRepository,
  eventPublisher: EventsService = eventsService
): NotificationsService => ({
  listNotifications: async (userId, query) => {
    const input: ListNotificationsInput = {
      cursor: decodeNotificationsCursor(query.cursor),
      limit: query.limit
    };
    const result = await repository.listNotificationsForUser(userId, input);

    return {
      notifications: result.notifications.map(toNotificationDto),
      unreadCount: result.unreadCount,
      pagination: {
        limit: query.limit,
        nextCursor: result.nextCursor
          ? encodeNotificationsCursor(result.nextCursor)
          : null,
        hasMore: result.hasMore
      }
    };
  },

  markNotificationRead: async (notificationId, userId) => {
    const result = await repository.markNotificationRead(
      notificationId,
      userId
    );

    if (!result) {
      throw new HttpError(404, "NOT_FOUND", "Notification not found");
    }

    eventPublisher.publishNotificationRead(userId, {
      notificationId: result.notification.id,
      club: {
        id: result.notification.club.id,
        linkName: result.notification.club.linkName
      },
      postId: result.notification.postId,
      commentId: result.notification.commentId,
      occurredAt: (result.notification.readAt ?? new Date()).toISOString()
    });

    return {
      notification: toNotificationDto(result.notification),
      unreadCount: result.unreadCount
    };
  },

  markAllNotificationsRead: async (userId) =>
    repository.markAllNotificationsRead(userId),

  deleteNotification: async (notificationId, userId) => {
    const result = await repository.deleteNotification(notificationId, userId);

    if (!result) {
      throw new HttpError(404, "NOT_FOUND", "Notification not found");
    }

    return result;
  },

  deleteAllNotifications: async (userId) =>
    repository.deleteAllNotifications(userId)
});

export const notificationsService = createNotificationsService();

const encodeNotificationsCursor = ({ createdAt, id }: NotificationsCursor) =>
  Buffer.from(
    JSON.stringify({
      createdAt: createdAt.toISOString(),
      id
    })
  ).toString("base64url");

const decodeNotificationsCursor = (
  cursor: string | undefined
): NotificationsCursor | null => {
  if (!cursor) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8")
    ) as unknown;

    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("createdAt" in parsed) ||
      !("id" in parsed) ||
      typeof parsed.createdAt !== "string" ||
      typeof parsed.id !== "string"
    ) {
      throw new Error("Malformed cursor");
    }

    const createdAt = new Date(parsed.createdAt);

    if (Number.isNaN(createdAt.getTime())) {
      throw new Error("Malformed cursor");
    }

    return {
      createdAt,
      id: parsed.id
    };
  } catch {
    throw new HttpError(
      400,
      "BAD_REQUEST",
      "Check the notifications request and try again."
    );
  }
};
