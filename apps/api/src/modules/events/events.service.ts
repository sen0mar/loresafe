import { randomUUID } from "node:crypto";
import type { Response } from "express";

import { HttpError } from "../../core/errors/http-error.js";
import { logger, sanitizeError } from "../../core/logging/logger.js";
import {
  createNoopEventsTransport,
  createPostgresEventsTransport,
  type EventEnvelope,
  type EventName,
  type EventsTransport
} from "./events.transport.js";

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
  start: () => Promise<void>;
  stop: () => Promise<void>;
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

export const createEventsService = (
  transport: EventsTransport = createNoopEventsTransport(),
  {
    maxConnectionsPerIp = 20,
    maxConnectionsPerUser = 5
  }: EventsServiceOptions = {}
): EventsService => {
  const instanceId = randomUUID();
  const connectionsByUserId = new Map<string, Map<string, Connection>>();
  const connectionCountByIp = new Map<string, number>();
  let started = false;

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
    const connectionIds = [
      ...(connectionsByUserId.get(userId)?.keys() ?? [])
    ];

    for (const connectionId of connectionIds) {
      closeConnection(userId, connectionId);
    }
  };

  const dispatch = (event: EventEnvelope) => {
    if (event.sourceInstanceId === instanceId) {
      return;
    }

    if (event.eventName === "session.revoked") {
      disconnectLocalUser(event.userId);
      return;
    }

    publishLocal(
      connectionsByUserId,
      event.userId,
      event.eventName,
      event.payload as NotificationEventPayload,
      closeConnection
    );
  };

  const publish = async (
    userId: string,
    eventName: EventName,
    payload: unknown
  ) => {
    const event = {
      sourceInstanceId: instanceId,
      userId,
      eventName,
      payload
    } satisfies EventEnvelope;

    dispatch({
      ...event,
      sourceInstanceId: "local"
    });

    if (!started) {
      return;
    }

    try {
      await transport.publish(event);
    } catch (error) {
      logger.error("SSE event transport publish failed", {
        eventName,
        error: sanitizeError(error)
      });
    }
  };

  return {
    start: async () => {
      if (started) {
        return;
      }

      await transport.start(dispatch);
      started = true;
    },

    stop: async () => {
      started = false;

      for (const userId of [...connectionsByUserId.keys()]) {
        disconnectLocalUser(userId);
      }

      await transport.stop();
    },

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
      await publish(userId, "session.revoked", null);
    },

    publishNotificationCreated: (userId, payload) =>
      publish(userId, "notification.created", payload),

    publishNotificationRead: (userId, payload) =>
      publish(userId, "notification.read", payload)
  };
};

export const eventsService = createEventsService(
  createPostgresEventsTransport()
);

const publishLocal = (
  connectionsByUserId: Map<string, Map<string, Connection>>,
  userId: string,
  eventName: Exclude<EventName, "session.revoked">,
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
  eventName: Exclude<EventName, "session.revoked">,
  payload: NotificationEventPayload
) => `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
