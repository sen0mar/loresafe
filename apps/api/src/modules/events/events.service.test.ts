import type { Response } from "express";
import { describe, expect, it, vi } from "vitest";

import { createEventsService } from "./events.service.js";
import type { EventEnvelope, EventsTransport } from "./events.transport.js";

describe("events service", () => {
  it("delivers safe events and revocation across API instances", async () => {
    const hub = new SharedEventsHub();
    const firstService = createEventsService(hub.createTransport());
    const secondService = createEventsService(hub.createTransport());
    const response = createResponse();
    const userId = crypto.randomUUID();

    await Promise.all([firstService.start(), secondService.start()]);
    secondService.subscribe(userId, "203.0.113.10", response.value);

    await firstService.publishNotificationCreated(userId, {
      notificationId: crypto.randomUUID(),
      club: {
        id: crypto.randomUUID(),
        linkName: "safe-club"
      },
      postId: null,
      commentId: null,
      occurredAt: "2026-07-09T12:00:00.000Z"
    });

    expect(response.write).toHaveBeenCalledWith(
      expect.stringContaining("event: notification.created")
    );

    await firstService.disconnectUser(userId);

    expect(response.end).toHaveBeenCalledOnce();
    await Promise.all([firstService.stop(), secondService.stop()]);
  });

  it("closes slow clients when response backpressure is reached", () => {
    const service = createEventsService();
    const response = createResponse(false);
    const subscription = service.subscribe(
      crypto.randomUUID(),
      "203.0.113.20",
      response.value
    );

    expect(subscription.heartbeat()).toBe(false);
    expect(response.end).toHaveBeenCalledOnce();
  });

  it("caps concurrent connections per user", () => {
    const service = createEventsService(undefined, {
      maxConnectionsPerUser: 1
    });
    const userId = crypto.randomUUID();

    service.subscribe(userId, "203.0.113.30", createResponse().value);

    expect(() =>
      service.subscribe(userId, "203.0.113.31", createResponse().value)
    ).toThrow("Too many realtime connections are open.");
  });
});

class SharedEventsHub {
  private readonly handlers = new Set<(event: EventEnvelope) => void>();

  createTransport = (): EventsTransport => {
    let handler: ((event: EventEnvelope) => void) | null = null;

    return {
      start: async (nextHandler) => {
        handler = nextHandler;
        this.handlers.add(nextHandler);
      },
      publish: async (event) => {
        for (const currentHandler of this.handlers) {
          currentHandler(event);
        }
      },
      stop: async () => {
        if (handler) {
          this.handlers.delete(handler);
        }
      }
    };
  };
}

const createResponse = (writeResult = true) => {
  const response = {
    destroyed: false,
    writableEnded: false,
    write: vi.fn(() => writeResult),
    end: vi.fn(() => {
      response.writableEnded = true;
      return response;
    })
  };

  return {
    value: response as unknown as Response,
    write: response.write,
    end: response.end
  };
};
