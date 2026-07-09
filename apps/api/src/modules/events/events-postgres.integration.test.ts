import type { Response } from "express";
import { describe, expect, it, vi } from "vitest";

import { createEventsService } from "./events.service.js";
import { createPostgresEventsTransport } from "./events.transport.js";

const describeDatabase =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;

describeDatabase("PostgreSQL SSE transport", () => {
  it("delivers and revokes a connection across API instances", async () => {
    const firstService = createEventsService(createPostgresEventsTransport());
    const secondService = createEventsService(createPostgresEventsTransport());
    const response = createResponse();
    const userId = crypto.randomUUID();

    try {
      await Promise.all([firstService.start(), secondService.start()]);
      secondService.subscribe(userId, "203.0.113.50", response.value);

      await firstService.publishNotificationCreated(userId, {
        notificationId: crypto.randomUUID(),
        club: {
          id: crypto.randomUUID(),
          linkName: "postgres-events"
        },
        postId: null,
        commentId: null,
        occurredAt: "2026-07-09T12:00:00.000Z"
      });
      await waitFor(() => response.write.mock.calls.length > 0);

      expect(response.write).toHaveBeenCalledWith(
        expect.stringContaining("event: notification.created")
      );

      await firstService.disconnectUser(userId);
      await waitFor(() => response.end.mock.calls.length > 0);

      expect(response.end).toHaveBeenCalledOnce();
    } finally {
      await Promise.all([firstService.stop(), secondService.stop()]);
    }
  }, 20_000);
});

const createResponse = () => {
  const response = {
    destroyed: false,
    writableEnded: false,
    write: vi.fn(() => true),
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

const waitFor = async (condition: () => boolean) => {
  const deadline = Date.now() + 5_000;

  while (!condition()) {
    if (Date.now() >= deadline) {
      throw new Error("Timed out waiting for PostgreSQL event delivery.");
    }

    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};
