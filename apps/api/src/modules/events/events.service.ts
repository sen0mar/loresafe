import { randomUUID } from "node:crypto";
import type { Response } from "express";

import { HttpError } from "../../core/errors/http-error.js";

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

export type EventSubscription = {
  heartbeat: () => boolean;
  close: () => void;
};

export type EventsService = {
  getConnectionCount: () => number;
  subscribe: (
    userId: string,
    clientIp: string,
    response: Response
  ) => EventSubscription;
  disconnectUser: (userId: string) => Promise<void>;
  publishNotificationCreated: (
    userId: string,
    payload: NotificationEventPayload
  ) => Promise<void>;
  publishNotificationRead: (
    userId: string,
    payload: NotificationEventPayload
  ) => Promise<void>;
};

type EventsServiceOptions = {
  maxConnectionsPerIp?: number;
  maxConnectionsPerUser?: number;
};

type Connection = {
  id: string;
  clientIp: string;
  response: Response;
};

export const createEventsService = ({
  maxConnectionsPerIp = 20,
  maxConnectionsPerUser = 5
}: EventsServiceOptions = {}): EventsService => {
  const connectionsByUserId = new Map<string, Map<string, Connection>>();
  const connectionCountByIp = new Map<string, number>();

  const closeConnection = (userId: string, connectionId: string) => {
    const userConnections = connectionsByUserId.get(userId);
    const connection = userConnections?.get(connectionId);

    if (!userConnections || !connection) {
      return;
    }

    userConnections.delete(connectionId);
    decrementIpCount(connectionCountByIp, connection.clientIp);

    if (userConnections.size === 0) {
      connectionsByUserId.delete(userId);
    }

    if (!connection.response.writableEnded) {
      connection.response.end();
    }
  };

  const disconnectLocalUser = (userId: string) => {
    const connectionIds = [...(connectionsByUserId.get(userId)?.keys() ?? [])];

    for (const connectionId of connectionIds) {
      closeConnection(userId, connectionId);
    }
  };

  const publish = (
    userId: string,
    eventName: NotificationEventName,
    payload: NotificationEventPayload
  ) => {
    publishLocal(
      connectionsByUserId,
      userId,
      eventName,
      payload,
      closeConnection
    );
    return Promise.resolve();
  };

  return {
    getConnectionCount: () =>
      [...connectionsByUserId.values()].reduce(
        (total, connections) => total + connections.size,
        0
      ),

    subscribe: (userId, clientIp, response) => {
      const userConnections =
        connectionsByUserId.get(userId) ?? new Map<string, Connection>();
      const ipConnectionCount = connectionCountByIp.get(clientIp) ?? 0;

      if (
        userConnections.size >= maxConnectionsPerUser ||
        ipConnectionCount >= maxConnectionsPerIp
      ) {
        throw new HttpError(
          429,
          "TOO_MANY_REQUESTS",
          "Too many realtime connections are open."
        );
      }

      const connectionId = randomUUID();
      userConnections.set(connectionId, {
        id: connectionId,
        clientIp,
        response
      });
      connectionsByUserId.set(userId, userConnections);
      connectionCountByIp.set(clientIp, ipConnectionCount + 1);

      return {
        heartbeat: () =>
          writeToConnection(
            userId,
            connectionId,
            response,
            ": heartbeat\n\n",
            closeConnection
          ),
        close: () => closeConnection(userId, connectionId)
      };
    },

    disconnectUser: async (userId) => {
      disconnectLocalUser(userId);
    },

    publishNotificationCreated: (userId, payload) =>
      publish(userId, "notification.created", payload),

    publishNotificationRead: (userId, payload) =>
      publish(userId, "notification.read", payload)
  };
};

export const eventsService = createEventsService();

const publishLocal = (
  connectionsByUserId: Map<string, Map<string, Connection>>,
  userId: string,
  eventName: NotificationEventName,
  payload: NotificationEventPayload,
  closeConnection: (userId: string, connectionId: string) => void
) => {
  const connections = connectionsByUserId.get(userId);

  if (!connections) {
    return;
  }

  for (const connection of [...connections.values()]) {
    writeToConnection(
      userId,
      connection.id,
      connection.response,
      formatEvent(eventName, payload),
      closeConnection
    );
  }
};

const writeToConnection = (
  userId: string,
  connectionId: string,
  response: Response,
  value: string,
  closeConnection: (userId: string, connectionId: string) => void
) => {
  if (response.writableEnded || response.destroyed || !response.write(value)) {
    closeConnection(userId, connectionId);
    return false;
  }

  return true;
};

const decrementIpCount = (counts: Map<string, number>, clientIp: string) => {
  const nextCount = (counts.get(clientIp) ?? 1) - 1;

  if (nextCount <= 0) {
    counts.delete(clientIp);
    return;
  }

  counts.set(clientIp, nextCount);
};

const formatEvent = (
  eventName: NotificationEventName,
  payload: NotificationEventPayload
) => `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;

type NotificationEventName = "notification.created" | "notification.read";
