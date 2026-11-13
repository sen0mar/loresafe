import { describe, expect, it } from "vitest";

import { scrubAnalyticsEvent } from "./web-analytics";

const pageview = (url: string) => ({ type: "pageview" as const, url });

describe("scrubAnalyticsEvent", () => {
  it("drops query strings and fragments that can carry tokens", () => {
    expect(
      scrubAnalyticsEvent(
        pageview(
          "https://www.loresafe.org/reset-password?token=RESET_SENTINEL#x"
        )
      )
    ).toEqual(pageview("https://www.loresafe.org/reset-password"));
    expect(
      scrubAnalyticsEvent(
        pageview("https://www.loresafe.org/verify-email?token=VERIFY_SENTINEL")
      )
    ).toEqual(pageview("https://www.loresafe.org/verify-email"));
  });

  it("replaces invite tokens in the path", () => {
    expect(
      scrubAnalyticsEvent(
        pageview("https://www.loresafe.org/invite/INVITE_SENTINEL")
      )
    ).toEqual(pageview("https://www.loresafe.org/invite/[token]"));
  });

  it("keeps ordinary paths and event types", () => {
    expect(
      scrubAnalyticsEvent({
        type: "event",
        url: "https://www.loresafe.org/app/clubs/book-club?tab=posts"
      })
    ).toEqual({
      type: "event",
      url: "https://www.loresafe.org/app/clubs/book-club"
    });
  });

  it("drops events with unparseable URLs", () => {
    expect(scrubAnalyticsEvent(pageview("not a url"))).toBeNull();
  });
});
