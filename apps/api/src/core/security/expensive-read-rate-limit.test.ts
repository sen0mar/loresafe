import { MemoryStore } from "express-rate-limit";
import request from "supertest";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const { databaseAccess } = vi.hoisted(() => ({ databaseAccess: vi.fn() }));

vi.mock("../prisma/client.js", async () => {
  const { HttpError } = await import("../errors/http-error.js");
  return {
    prisma: new Proxy(
      {},
      {
        get: (_target, property) => {
          databaseAccess(property);
          throw new HttpError(
            503,
            "SERVICE_UNAVAILABLE",
            "Test database boundary"
          );
        }
      }
    )
  };
});

import { createApp } from "../../app.js";
import { env } from "../../config/env.js";
import { authService } from "../../modules/auth/auth.service.js";
import { createRateLimiters } from "./rate-limit.js";
import { createSessionToken } from "./session-token.js";

const readPaths = [
  "/api/posts/00000000-0000-4000-8000-000000000001",
  "/api/posts/00000000-0000-4000-8000-000000000001/comments",
  "/api/notifications",
  "/api/clubs",
  "/api/clubs/test-club",
  "/api/users/me/clubs",
  "/api/clubs/test-club/members",
  "/api/clubs/test-club/bans",
  "/api/clubs/test-club/milestones",
  "/api/clubs/test-club/progress",
  "/api/clubs/test-club/recently-unlocked"
];

const user = {
  id: "00000000-0000-4000-8000-000000000002",
  email: "read-limit@example.com",
  username: "read_limit",
  displayName: "Read limit",
  bio: null,
  avatarUrl: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const createTestApp = (stores = new Map<string, MemoryStore>()) =>
  createApp(env, {
    rateLimiters: createRateLimiters({
      storeFactory: (prefix) => {
        const store = new MemoryStore();
        stores.set(prefix, store);
        return store;
      }
    })
  });

let cookie: string;
beforeAll(async () => {
  cookie = `${env.SESSION_COOKIE_NAME}=${await createSessionToken({
    userId: user.id,
    sessionVersion: 0
  })}`;
});
afterEach(() => vi.restoreAllMocks());

describe("expensive read admission", () => {
  it.each(readPaths)(
    "admits %s to auth and domain repositories within budget",
    async (path) => {
      const app = createTestApp();
      databaseAccess.mockClear();
      await request(app).get(path).set("Cookie", cookie).expect(503);
      expect(databaseAccess).toHaveBeenCalledWith("user");

      vi.spyOn(authService, "resolveCurrentUser").mockResolvedValue(user);
      databaseAccess.mockClear();
      await request(app).get(path).set("Cookie", cookie).expect(503);
      expect(databaseAccess).toHaveBeenCalled();
    }
  );
});

describe("exhausted expensive read bucket", () => {
  const stores = new Map<string, MemoryStore>();
  const app = createTestApp(stores);
  beforeAll(async () => {
    const store = stores.get("loresafe:rl:reads:expensive:")!;
    const increment = vi.spyOn(store, "increment");
    await request(app).get("/api/clubs/test-club/posts").expect(401);
    // Fill the real store for the observed IP without opening hundreds of sockets.
    const key = increment.mock.calls[0]![0];
    for (let index = 1; index < 240; index++) await store.increment(key);
  });

  it.each(readPaths)(
    "blocks %s before session lookup or repository access",
    async (path) => {
      const resolveUser = vi.spyOn(authService, "resolveCurrentUser");
      databaseAccess.mockClear();
      const response = await request(app)
        .get(`${path}/?limit=1`)
        .set("Cookie", cookie)
        .expect(429);
      expect(response.body.error.code).toBe("TOO_MANY_REQUESTS");
      expect(Number(response.headers["retry-after"])).toBeGreaterThan(0);
      await request(app).head(path).set("Cookie", cookie).expect(429);
      expect(resolveUser).not.toHaveBeenCalled();
      expect(databaseAccess).not.toHaveBeenCalled();
    }
  );

  it("keeps notification writes available after reads exhaust their budget", async () => {
    await request(app).post("/api/notifications/read-all").expect(401);
  });

  it("rejects before JSON parsing", async () => {
    await request(app)
      .get("/api/notifications")
      .set("Content-Type", "application/json")
      .send("{")
      .expect(429);
  });
});

describe("read/write bucket independence", () => {
  it("keeps reads available after notification writes exhaust their budget", async () => {
    const stores = new Map<string, MemoryStore>();
    const app = createTestApp(stores);
    const store = stores.get("loresafe:rl:notifications:mutate:")!;
    const increment = vi.spyOn(store, "increment");
    await request(app).post("/api/notifications/read-all").expect(401);
    const key = increment.mock.calls[0]![0];
    for (let index = 1; index < 180; index++) await store.increment(key);
    await request(app).post("/api/notifications/read-all").expect(429);
    await request(app).get("/api/notifications").expect(401);
  });
});
