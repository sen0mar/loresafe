import request from "supertest";
import { MemoryStore } from "express-rate-limit";
import { describe, expect, it, vi } from "vitest";

import { createApp as createApiApp } from "../../app.js";
import { parseEnv } from "../../config/env.js";
import { isPrismaClientInitialized } from "../../core/prisma/client.js";
import { createRateLimiters } from "../../core/security/rate-limit.js";
import type { ReadinessDependencies } from "./readiness.service.js";

const createReadinessDependencies = (
  overrides: Partial<ReadinessDependencies> = {}
): ReadinessDependencies => ({
  database: async () => undefined,
  redis: async () => undefined,
  storage: async () => undefined,
  ...overrides
});

const createTestApp = (
  appEnv: Parameters<typeof createApiApp>[0],
  readiness = createReadinessDependencies()
) =>
  createApiApp(appEnv, {
    rateLimiters: createRateLimiters({
      storeFactory: () => new MemoryStore()
    }),
    readiness
  });

describe("health routes", () => {
  const testAppName = "LoreSafe Health Test";
  const app = createTestApp(
    parseEnv({
      APP_NAME: testAppName,
      DATABASE_URL: "postgresql://test:test@localhost:5432/loresafe_test",
      JWT_SECRET: "a".repeat(32)
    })
  );

  it("returns live API health metadata", async () => {
    const response = await request(app).get("/api/health").expect(200);

    expect(response.body).toMatchObject({
      appName: testAppName,
      status: "ok"
    });
    expect(new Date(response.body.timestamp).toISOString()).toBe(
      response.body.timestamp
    );
    expect(response.headers["x-request-id"]).toEqual(expect.any(String));
    expect(response.headers["x-robots-tag"]).toBe("noindex, nofollow");
  });

  it("performs no dependency work across repeated liveness probes", async () => {
    const dependencies = {
      database: vi.fn(async () => undefined),
      redis: vi.fn(async () => undefined),
      storage: vi.fn(async () => undefined)
    } satisfies ReadinessDependencies;
    const livenessApp = createTestApp(undefined, dependencies);
    const server = livenessApp.listen(0);

    expect(isPrismaClientInitialized()).toBe(false);
    await request(server).get("/api/health").expect(200);
    await request(server).get("/api/health").expect(200);
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });

    expect(isPrismaClientInitialized()).toBe(false);
    expect(dependencies.database).not.toHaveBeenCalled();
    expect(dependencies.redis).not.toHaveBeenCalled();
    expect(dependencies.storage).not.toHaveBeenCalled();
  });

  it("reports ready only when every bounded dependency check succeeds", async () => {
    const readinessApp = createTestApp(
      undefined,
      createReadinessDependencies()
    );
    const response = await request(readinessApp)
      .get("/api/health/ready")
      .expect(200);

    expect(response.body.status).toBe("ready");
    expect(response.body.checks).toEqual({
      database: expect.objectContaining({ status: "ready" }),
      redis: expect.objectContaining({ status: "ready" }),
      storage: expect.objectContaining({ status: "ready" })
    });
  });

  it("keeps operations metrics hidden unless the bearer token matches", async () => {
    const operationsToken = "o".repeat(32);
    const operationsApp = createTestApp(
      parseEnv({
        DATABASE_URL: "postgresql://test:test@localhost:5432/loresafe_test",
        JWT_SECRET: "a".repeat(32),
        OPERATIONS_BEARER_TOKEN: operationsToken
      })
    );

    await request(operationsApp).get("/api/health/metrics").expect(404);
    const response = await request(operationsApp)
      .get("/api/health/metrics")
      .set("Authorization", `Bearer ${operationsToken}`)
      .expect(200);

    expect(response.text).toContain("loresafe_http_requests_total");
    expect(response.text).toContain("loresafe_sse_connections");
  });

  it("returns 503 with safe dependency status when readiness is degraded", async () => {
    const readinessApp = createTestApp(
      undefined,
      createReadinessDependencies({
        storage: async () => {
          throw new Error("private storage detail");
        }
      })
    );
    const response = await request(readinessApp)
      .get("/api/health/ready")
      .expect(503);

    expect(response.body.status).toBe("degraded");
    expect(response.body.checks.storage.status).toBe("unavailable");
    expect(JSON.stringify(response.body)).not.toContain(
      "private storage detail"
    );
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
    const productionApp = createTestApp(
      parseEnv({
        CLIENT_ORIGIN: "https://legacy.loresafe.example",
        CLIENT_ORIGINS:
          "https://app.loresafe.example,https://admin.loresafe.example",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/loresafe",
        JWT_SECRET: "a".repeat(32),
        NODE_ENV: "production",
        R2_ACCESS_KEY_ID: "r2-access-key",
        R2_ACCOUNT_ID: "r2-account",
        R2_BUCKET_NAME: "loresafe-assets",
        R2_PUBLIC_BASE_URL: "https://cdn.loresafe.example",
        R2_SECRET_ACCESS_KEY: "r2-secret-key",
        SENTRY_DSN: "https://public@example.ingest.sentry.io/1",
        OPERATIONS_BEARER_TOKEN: "o".repeat(32),
        TRUST_PROXY_CIDRS: "loopback",
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
    const productionApp = createTestApp(
      parseEnv({
        CLIENT_ORIGIN: "https://legacy.loresafe.example",
        CLIENT_ORIGINS: "https://app.loresafe.example",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/loresafe",
        JWT_SECRET: "a".repeat(32),
        NODE_ENV: "production",
        R2_ACCESS_KEY_ID: "r2-access-key",
        R2_ACCOUNT_ID: "r2-account",
        R2_BUCKET_NAME: "loresafe-assets",
        R2_PUBLIC_BASE_URL: "https://cdn.loresafe.example",
        R2_SECRET_ACCESS_KEY: "r2-secret-key",
        SENTRY_DSN: "https://public@example.ingest.sentry.io/1",
        OPERATIONS_BEARER_TOKEN: "o".repeat(32),
        TRUST_PROXY_CIDRS: "loopback",
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
