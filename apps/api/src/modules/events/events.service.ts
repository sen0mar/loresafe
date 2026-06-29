import type { Response } from "express";

export type NotificationEventPayload = {
  notificationId: string;
  club: {
    id: string;
    linkName: string;
  };
  postId: string | null;
  commentId: string | null;
  occurredAt: string;
};

export type EventsService = {
  subscribe: (userId: string, response: Response) => () => void;
  publishNotificationCreated: (
    userId: string,
    payload: NotificationEventPayload
  ) => void;
  publishNotificationRead: (
    userId: string,
    payload: NotificationEventPayload
  ) => void;
};

type EventName = "notification.created" | "notification.read";

export const createEventsService = (): EventsService => {
  const connectionsByUserId = new Map<string, Set<Response>>();

  const publish = (
    userId: string,
    eventName: EventName,
    payload: NotificationEventPayload
  ) => {
    const connections = connectionsByUserId.get(userId);

    if (!connections) {
      return;
    }

    for (const connection of connections) {
      connection.write(formatEvent(eventName, payload));
    }
  };

  return {
    subscribe: (userId, response) => {
      const connections = connectionsByUserId.get(userId) ?? new Set<Response>();

      connections.add(response);
      connectionsByUserId.set(userId, connections);

      return () => {
        connections.delete(response);

        if (connections.size === 0) {
          connectionsByUserId.delete(userId);
        }
      };
    },

    publishNotificationCreated: (userId, payload) => {
      publish(userId, "notification.created", payload);
    },

    publishNotificationRead: (userId, payload) => {
      publish(userId, "notification.read", payload);
    }
  };
};

export const eventsService = createEventsService();

const formatEvent = (
  eventName: EventName,
  payload: NotificationEventPayload
) => `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
