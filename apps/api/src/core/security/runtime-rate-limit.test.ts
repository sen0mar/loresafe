import { MemoryStore } from "express-rate-limit";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthRateLimiterOptions, RateLimiters } from "./rate-limit.js";

const { createRateLimitersMock } = vi.hoisted(() => ({
  createRateLimitersMock: vi.fn(
    (_options?: AuthRateLimiterOptions) => ({}) as RateLimiters
  )
}));

vi.mock("./rate-limit.js", () => ({
  createRateLimiters: createRateLimitersMock
}));

import { createRuntimeRateLimiters } from "./runtime-rate-limit.js";

describe("runtime rate limit store selection", () => {
  beforeEach(() => {
    createRateLimitersMock.mockClear();
  });

  it("uses isolated in-process stores for test runtimes without Redis credentials", () => {
    createRuntimeRateLimiters({
      NODE_ENV: "test",
      UPSTASH_REDIS_REST_TOKEN: undefined,
      UPSTASH_REDIS_REST_URL: undefined
    });

    const options = createRateLimitersMock.mock.calls[0]?.[0];

    expect(options?.storeFactory?.("test-prefix")).toBeInstanceOf(MemoryStore);
  });

  it("keeps the distributed store for production even if credentials are absent", () => {
    createRuntimeRateLimiters({
      NODE_ENV: "production",
      UPSTASH_REDIS_REST_TOKEN: undefined,
      UPSTASH_REDIS_REST_URL: undefined
    });

    expect(createRateLimitersMock).toHaveBeenCalledWith();
  });

  it("keeps the distributed store when a test runtime configures Redis", () => {
    createRuntimeRateLimiters({
      NODE_ENV: "test",
      UPSTASH_REDIS_REST_TOKEN: "redis-token",
      UPSTASH_REDIS_REST_URL: "https://redis.example"
    });

    expect(createRateLimitersMock).toHaveBeenCalledWith();
  });

  it("does not mask incomplete test Redis configuration", () => {
    createRuntimeRateLimiters({
      NODE_ENV: "test",
      UPSTASH_REDIS_REST_TOKEN: "redis-token",
      UPSTASH_REDIS_REST_URL: undefined
    });

    expect(createRateLimitersMock).toHaveBeenCalledWith();
  });
});
