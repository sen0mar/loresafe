export type EventName =
  "notification.created" | "notification.read" | "session.revoked";

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

export const createNoopEventsTransport = (): EventsTransport => ({
  start: async () => undefined,
  publish: async () => undefined,
  stop: async () => undefined
});
