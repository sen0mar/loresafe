import { Client } from "pg";

import { env } from "../../config/env.js";
import { logger, sanitizeError } from "../../core/logging/logger.js";
import { prisma } from "../../core/prisma/client.js";

export type EventName =
  | "notification.created"
  | "notification.read"
  | "session.revoked";

export type EventEnvelope = {
  sourceInstanceId: string;
  userId: string;
  eventName: EventName;
  payload: unknown;
};

export type EventsTransport = {
  start: (onEvent: (event: EventEnvelope) => void) => Promise<void>;
  publish: (event: EventEnvelope) => Promise<void>;
  stop: () => Promise<void>;
};

const channelName = "loresafe_user_events";
const reconnectDelayMs = 1_000;

export const createNoopEventsTransport = (): EventsTransport => ({
  start: async () => undefined,
  publish: async () => undefined,
  stop: async () => undefined
});

export const createPostgresEventsTransport = (): EventsTransport => {
  let listener: Client | null = null;
  let onEvent: ((event: EventEnvelope) => void) | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = true;
  let connecting: Promise<void> | null = null;

  const connect = async () => {
    if (stopped || listener) {
      return;
    }

    if (connecting) {
      return connecting;
    }

    connecting = (async () => {
      const client = new Client({
        // LISTEN requires a session-level direct connection, not a transaction pooler URL.
        connectionString: env.EVENTS_DATABASE_URL,
        application_name: "loresafe-api-events"
      });

      client.on("notification", (notification) => {
        const event = parseEventEnvelope(notification.payload);

        if (event) {
          onEvent?.(event);
        }
      });
      client.on("error", (error) => {
        logger.error("SSE event transport listener failed", {
          error: sanitizeError(error)
        });
        listener = null;
        scheduleReconnect();
      });
      client.on("end", () => {
        listener = null;
        scheduleReconnect();
      });

      await client.connect();
      await client.query(`LISTEN ${channelName}`);
      listener = client;
    })().finally(() => {
      connecting = null;
    });

    return connecting;
  };

  const scheduleReconnect = () => {
    if (stopped || reconnectTimer) {
      return;
    }

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void connect().catch((error) => {
        logger.error("SSE event transport reconnect failed", {
          error: sanitizeError(error)
        });
        scheduleReconnect();
      });
    }, reconnectDelayMs);
  };

  return {
    start: async (eventHandler) => {
      onEvent = eventHandler;
      stopped = false;
      await connect();
    },

    publish: async (event) => {
      const payload = JSON.stringify(event);

      if (Buffer.byteLength(payload, "utf8") > 7_500) {
        throw new Error("SSE event envelope exceeds the PostgreSQL payload limit.");
      }

      await prisma.$executeRaw`SELECT pg_notify(${channelName}, ${payload})`;
    },

    stop: async () => {
      stopped = true;
      onEvent = null;

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      const currentListener = listener;
      listener = null;

      if (currentListener) {
        await currentListener.end();
      }
    }
  };
};

const parseEventEnvelope = (payload: string | undefined) => {
  if (!payload) {
    return null;
  }

  try {
    const event = JSON.parse(payload) as unknown;

    if (
      !event ||
      typeof event !== "object" ||
      !("sourceInstanceId" in event) ||
      !("userId" in event) ||
      !("eventName" in event) ||
      !("payload" in event) ||
      typeof event.sourceInstanceId !== "string" ||
      typeof event.userId !== "string" ||
      !isEventName(event.eventName)
    ) {
      return null;
    }

    return event as EventEnvelope;
  } catch {
    return null;
  }
};

const isEventName = (value: unknown): value is EventName =>
  value === "notification.created" ||
  value === "notification.read" ||
  value === "session.revoked";
