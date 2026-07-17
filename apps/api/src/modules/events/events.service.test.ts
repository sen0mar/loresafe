import type { Response } from "express";
import { describe, expect, it, vi } from "vitest";

import { createEventsService } from "./events.service.js";

describe("events service", () => {
  it("delivers safe events and revocation to local subscribers", async () => {
    const service = createEventsService();
    const response = createResponse();
    const userId = crypto.randomUUID();

    service.subscribe(userId, "203.0.113.10", response.value);

    await service.publishNotificationCreated(userId, {
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

    await service.disconnectUser(userId);

    expect(response.end).toHaveBeenCalledOnce();
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
    const service = createEventsService({
      maxConnectionsPerUser: 1
    });
    const userId = crypto.randomUUID();

    service.subscribe(userId, "203.0.113.30", createResponse().value);

    expect(() =>
      service.subscribe(userId, "203.0.113.31", createResponse().value)
    ).toThrow("Too many realtime connections are open.");
  });
});

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
