import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import { parseEnv } from "../../config/env.js";

describe("health routes", () => {
  const app = createApp();

  it("returns live API health metadata", async () => {
    const response = await request(app).get("/api/health").expect(200);

    expect(response.body).toMatchObject({
      appName: "LoreSafe",
      status: "ok"
    });
    expect(new Date(response.body.timestamp).toISOString()).toBe(
      response.body.timestamp
    );
    expect(response.headers["x-request-id"]).toEqual(expect.any(String));
    expect(response.headers["x-robots-tag"]).toBe("noindex, nofollow");
  });

  it("allows the Vite fallback dev origin", async () => {
    const response = await request(app)
      .get("/api/health")
      .set("Origin", "http://localhost:5174")
      .expect(200);

    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5174"
    );
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("allows only configured production CORS origins", async () => {
    const productionApp = createApp(
      parseEnv({
        CLIENT_ORIGIN: "https://legacy.loresafe.example",
        CLIENT_ORIGINS: "https://app.loresafe.example,https://admin.loresafe.example",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/loresafe",
        DEMO_USER_DISPLAY_NAME: "Demo Reader",
        DEMO_USER_EMAIL: "demo@example.com",
        DEMO_USER_PASSWORD: "correct horse battery",
        JWT_SECRET: "a".repeat(32),
        NODE_ENV: "production",
        R2_ACCESS_KEY_ID: "r2-access-key",
        R2_ACCOUNT_ID: "r2-account",
        R2_BUCKET_NAME: "loresafe-assets",
        R2_PUBLIC_BASE_URL: "https://cdn.loresafe.example",
        R2_SECRET_ACCESS_KEY: "r2-secret-key",
        SENTRY_DSN: "https://public@example.ingest.sentry.io/1",
        UPSTASH_REDIS_REST_TOKEN: "redis-token",
        UPSTASH_REDIS_REST_URL: "https://redis.example"
      })
    );

    const allowedResponse = await request(productionApp)
      .get("/api/health")
      .set("Origin", "https://app.loresafe.example")
      .expect(200);

    expect(allowedResponse.headers["access-control-allow-origin"]).toBe(
      "https://app.loresafe.example"
    );
    expect(allowedResponse.headers["access-control-allow-credentials"]).toBe(
      "true"
    );

    const rejectedResponse = await request(productionApp)
      .get("/api/health")
      .set("Origin", "https://evil.example")
      .expect(200);

    expect(rejectedResponse.headers).not.toHaveProperty(
      "access-control-allow-origin"
    );
  });

  it("rejects unsafe production requests without a trusted origin", async () => {
    const productionApp = createApp(
      parseEnv({
        CLIENT_ORIGIN: "https://legacy.loresafe.example",
        CLIENT_ORIGINS: "https://app.loresafe.example",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/loresafe",
        DEMO_USER_DISPLAY_NAME: "Demo Reader",
        DEMO_USER_EMAIL: "demo@example.com",
        DEMO_USER_PASSWORD: "correct horse battery",
        JWT_SECRET: "a".repeat(32),
        NODE_ENV: "production",
        R2_ACCESS_KEY_ID: "r2-access-key",
        R2_ACCOUNT_ID: "r2-account",
        R2_BUCKET_NAME: "loresafe-assets",
        R2_PUBLIC_BASE_URL: "https://cdn.loresafe.example",
        R2_SECRET_ACCESS_KEY: "r2-secret-key",
        SENTRY_DSN: "https://public@example.ingest.sentry.io/1",
        UPSTASH_REDIS_REST_TOKEN: "redis-token",
        UPSTASH_REDIS_REST_URL: "https://redis.example"
      })
    );

    await request(productionApp).post("/api/missing").expect(403);
    await request(productionApp)
      .post("/api/missing")
      .set("Origin", "https://evil.example")
      .expect(403);
    await request(productionApp)
      .post("/api/missing")
      .set("Origin", "https://app.loresafe.example")
      .expect(404);
  });

  it("returns the shared error shape for unknown API routes", async () => {
    const response = await request(app)
      .get("/api/missing")
      .set("x-request-id", "test-request-id")
      .expect(404);

    expect(response.body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
        requestId: "test-request-id"
      }
    });
    expect(response.headers["x-robots-tag"]).toBe("noindex, nofollow");
  });

  it("keeps the debug Sentry route unavailable in tests", async () => {
    const response = await request(app)
      .get("/api/debug/sentry-error")
      .set("x-request-id", "test-unexpected-error")
      .expect(404);

    expect(response.body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
        requestId: "test-unexpected-error"
      }
    });
  });
});
