import { describe, expect, it, vi } from "vitest";

type CapturedRateLimitOptions = {
  identifier?: string;
  legacyHeaders?: boolean;
  limit?: number;
  skipSuccessfulRequests?: boolean;
  standardHeaders?: string;
  store?: {
    prefix: string;
  };
  windowMs?: number;
};

const { createStoreMock, rateLimitMock } = vi.hoisted(() => ({
  createStoreMock: vi.fn((prefix: string) => ({ prefix })),
  rateLimitMock: vi.fn((options: CapturedRateLimitOptions) => options)
}));

vi.mock("express-rate-limit", () => ({
  default: rateLimitMock
}));

vi.mock("./upstash-rate-limit-store.js", () => ({
  createUpstashRateLimitStore: createStoreMock
}));

const loadRateLimitOptions = async () => {
  vi.resetModules();
  createStoreMock.mockClear();
  rateLimitMock.mockClear();

  await import("./rate-limit.js");

  return rateLimitMock.mock.calls.map(([options]) => options);
};

describe("rate limit defaults", () => {
  it("uses the relaxed caps while preserving windows and stores", async () => {
    const options = await loadRateLimitOptions();
    const byIdentifier = Object.fromEntries(
      options.map((option) => [
        option.identifier,
        {
          limit: option.limit,
          skipSuccessfulRequests: option.skipSuccessfulRequests,
          storePrefix: option.store?.prefix,
          windowMs: option.windowMs
        }
      ])
    );

    expect(byIdentifier).toEqual({
      "auth-login": {
        limit: 60,
        skipSuccessfulRequests: true,
        storePrefix: "loresafe:rl:auth:login:",
        windowMs: 15 * 60 * 1000
      },
      "auth-logout": {
        limit: 90,
        skipSuccessfulRequests: false,
        storePrefix: "loresafe:rl:auth:logout:",
        windowMs: 60 * 1000
      },
      "auth-passwordReset": {
        limit: 9,
        skipSuccessfulRequests: false,
        storePrefix: "loresafe:rl:auth:password-reset:",
        windowMs: 60 * 60 * 1000
      },
      "auth-signup": {
        limit: 60,
        skipSuccessfulRequests: false,
        storePrefix: "loresafe:rl:auth:signup:",
        windowMs: 60 * 60 * 1000
      },
      "users-profile-update": {
        limit: 60,
        skipSuccessfulRequests: undefined,
        storePrefix: "loresafe:rl:users:profile-update:",
        windowMs: 10 * 60 * 1000
      },
      "users-account-delete": {
        limit: 6,
        skipSuccessfulRequests: undefined,
        storePrefix: "loresafe:rl:users:account-delete:",
        windowMs: 60 * 60 * 1000
      },
      "uploads-public-assets": {
        limit: 90,
        skipSuccessfulRequests: undefined,
        storePrefix: "loresafe:rl:uploads:public-assets:",
        windowMs: 10 * 60 * 1000
      },
      "clubs-create": {
        limit: 45,
        skipSuccessfulRequests: undefined,
        storePrefix: "loresafe:rl:clubs:create:",
        windowMs: 10 * 60 * 1000
      },
      "clubs-join": {
        limit: 90,
        skipSuccessfulRequests: undefined,
        storePrefix: "loresafe:rl:clubs:join:",
        windowMs: 10 * 60 * 1000
      },
      "clubs-invites-create": {
        limit: 60,
        skipSuccessfulRequests: undefined,
        storePrefix: "loresafe:rl:clubs:invites:create:",
        windowMs: 10 * 60 * 1000
      },
      "clubs-members-manage": {
        limit: 180,
        skipSuccessfulRequests: undefined,
        storePrefix: "loresafe:rl:clubs:members:manage:",
        windowMs: 10 * 60 * 1000
      },
      "clubs-settings-update": {
        limit: 120,
        skipSuccessfulRequests: undefined,
        storePrefix: "loresafe:rl:clubs:settings:update:",
        windowMs: 10 * 60 * 1000
      },
      "clubs-milestones-create": {
        limit: 90,
        skipSuccessfulRequests: undefined,
        storePrefix: "loresafe:rl:clubs:milestones:create:",
        windowMs: 10 * 60 * 1000
      },
      "clubs-posts-create": {
        limit: 90,
        skipSuccessfulRequests: undefined,
        storePrefix: "loresafe:rl:clubs:posts:create:",
        windowMs: 10 * 60 * 1000
      },
      "posts-comments-create": {
        limit: 120,
        skipSuccessfulRequests: undefined,
        storePrefix: "loresafe:rl:posts:comments:create:",
        windowMs: 10 * 60 * 1000
      },
      "posts-reactions-toggle": {
        limit: 240,
        skipSuccessfulRequests: undefined,
        storePrefix: "loresafe:rl:posts:reactions:toggle:",
        windowMs: 10 * 60 * 1000
      },
      "reports-create": {
        limit: 30,
        skipSuccessfulRequests: undefined,
        storePrefix: "loresafe:rl:reports:create:",
        windowMs: 10 * 60 * 1000
      },
      search: {
        limit: 360,
        skipSuccessfulRequests: undefined,
        storePrefix: "loresafe:rl:search:",
        windowMs: 10 * 60 * 1000
      },
      "moderation-actions": {
        limit: 180,
        skipSuccessfulRequests: undefined,
        storePrefix: "loresafe:rl:moderation:actions:",
        windowMs: 10 * 60 * 1000
      },
      "comments-reactions-toggle": {
        limit: 240,
        skipSuccessfulRequests: undefined,
        storePrefix: "loresafe:rl:comments:reactions:toggle:",
        windowMs: 10 * 60 * 1000
      },
      "clubs-progress-update": {
        limit: 120,
        skipSuccessfulRequests: undefined,
        storePrefix: "loresafe:rl:clubs:progress:update:",
        windowMs: 10 * 60 * 1000
      },
      "invites-accept": {
        limit: 90,
        skipSuccessfulRequests: undefined,
        storePrefix: "loresafe:rl:invites:accept:",
        windowMs: 10 * 60 * 1000
      }
    });
  });

  it("keeps the shared rate-limit header behavior for every limiter", async () => {
    const options = await loadRateLimitOptions();

    expect(options).toHaveLength(22);
    expect(options).toEqual(
      options.map((option) =>
        expect.objectContaining({
          legacyHeaders: false,
          standardHeaders: "draft-8"
        })
      )
    );
  });
});
