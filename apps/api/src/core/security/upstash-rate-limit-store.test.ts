import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { RedisMock, redisClient } = vi.hoisted(() => {
  const client = {
    decr: vi.fn(),
    del: vi.fn(),
    evalsha: vi.fn(),
    scriptLoad: vi.fn()
  };

  return {
    RedisMock: vi.fn(
      class {
        decr = client.decr;
        del = client.del;
        evalsha = client.evalsha;
        scriptLoad = client.scriptLoad;
      }
    ),
    redisClient: client
  };
});

vi.mock("@upstash/redis", () => ({
  Redis: RedisMock
}));

import { createUpstashRateLimitStore } from "./upstash-rate-limit-store.js";

describe("Upstash rate-limit store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-19T12:00:00.000Z"));
    vi.clearAllMocks();
    redisClient.scriptLoad
      .mockResolvedValueOnce("increment-script-sha")
      .mockResolvedValueOnce("get-script-sha");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("translates RedisStore initialization and counter commands", async () => {
    redisClient.evalsha.mockResolvedValueOnce([2, 30_000]);
    const store = createUpstashRateLimitStore("loresafe:rl:test:");

    await store.init({
      windowMs: 60_000
    } as Parameters<typeof store.init>[0]);
    const incremented = await store.increment("client-key");
    await store.decrement("client-key");
    await store.resetKey("client-key");

    expect(RedisMock).toHaveBeenCalledOnce();
    expect(redisClient.scriptLoad).toHaveBeenCalledTimes(2);
    expect(redisClient.scriptLoad.mock.calls[0]?.[0]).toContain(
      'redis.call("INCR", KEYS[1])'
    );
    expect(redisClient.scriptLoad.mock.calls[1]?.[0]).toContain(
      'redis.call("GET", KEYS[1])'
    );
    expect(redisClient.evalsha).toHaveBeenCalledWith(
      "increment-script-sha",
      ["loresafe:rl:test:client-key"],
      ["60000"]
    );
    expect(incremented).toEqual({
      totalHits: 2,
      resetTime: new Date("2026-07-19T12:00:30.000Z")
    });
    expect(redisClient.decr).toHaveBeenCalledWith(
      "loresafe:rl:test:client-key"
    );
    expect(redisClient.del).toHaveBeenCalledWith("loresafe:rl:test:client-key");
  });
});
