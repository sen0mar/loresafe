import { describe, expect, it } from "vitest";

import {
  redactInviteTokens,
  scrubSentryBreadcrumb,
  scrubSentryEvent
} from "./sentry-scrubbing";

const sentinelToken = "sentinel_private_invite_token_123456789012";

describe("Sentry invite-token scrubbing", () => {
  it("redacts invite tokens without changing unrelated URLs", () => {
    expect(redactInviteTokens(`/invite/${sentinelToken}?source=email`)).toBe(
      "/invite/:redacted?source=email"
    );
    expect(
      redactInviteTokens(
        `https://www.loresafe.org/api/invites/${sentinelToken}/accept`
      )
    ).toBe("https://www.loresafe.org/api/invites/:redacted/accept");
    expect(redactInviteTokens("/api/clubs/story-circle")).toBe(
      "/api/clubs/story-circle"
    );
  });

  it("redacts navigation and fetch breadcrumb fields", () => {
    const breadcrumb = scrubSentryBreadcrumb({
      category: "fetch",
      message: `POST /api/invites/${sentinelToken}/accept`,
      data: {
        from: "/app",
        to: `/invite/${sentinelToken}`,
        url: `/api/invites/${sentinelToken}/accept`
      }
    });

    expect(JSON.stringify(breadcrumb)).not.toContain(sentinelToken);
    expect(breadcrumb.data).toMatchObject({
      from: "/app",
      to: "/invite/:redacted",
      url: "/api/invites/:redacted/accept"
    });
  });

  it("redacts event URLs, transaction names, breadcrumbs, and spans", () => {
    const event = scrubSentryEvent({
      request: {
        url: `https://www.loresafe.org/invite/${sentinelToken}`
      },
      transaction: `/invite/${sentinelToken}`,
      breadcrumbs: [
        {
          data: {
            url: `/api/invites/${sentinelToken}/accept`
          }
        }
      ],
      spans: [
        {
          span_id: "1234567890abcdef",
          trace_id: "1234567890abcdef1234567890abcdef",
          start_timestamp: 1,
          timestamp: 2,
          op: "http.client",
          description: `POST /api/invites/${sentinelToken}/accept`,
          data: {
            url: `/api/invites/${sentinelToken}/accept`
          }
        }
      ]
    });

    expect(JSON.stringify(event)).not.toContain(sentinelToken);
    expect(event.transaction).toBe("/invite/:redacted");
    expect(event.spans?.[0]?.description).toBe(
      "POST /api/invites/:redacted/accept"
    );
  });
});
