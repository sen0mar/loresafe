import { describe, expect, it } from "vitest";

import { getAllowedCorsOrigins } from "./cors.js";
import { parseEnv } from "./env.js";

const baseEnv = {
  CLIENT_ORIGIN: "http://localhost:5173",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/loresafe",
  DEMO_USER_DISPLAY_NAME: "Demo Reader",
  DEMO_USER_EMAIL: "demo@example.com",
  DEMO_USER_PASSWORD: "correct horse battery",
  JWT_SECRET: "a".repeat(32)
} satisfies NodeJS.ProcessEnv;

const productionServiceEnv = {
  R2_ACCESS_KEY_ID: "r2-access-key",
  R2_ACCOUNT_ID: "r2-account",
  R2_BUCKET_NAME: "loresafe-assets",
  R2_PUBLIC_BASE_URL: "https://cdn.loresafe.example",
  R2_SECRET_ACCESS_KEY: "r2-secret-key",
  SENTRY_DSN: "https://public@example.ingest.sentry.io/1",
  UPSTASH_REDIS_REST_TOKEN: "redis-token",
  UPSTASH_REDIS_REST_URL: "https://redis.example"
} satisfies NodeJS.ProcessEnv;

describe("CORS config", () => {
  it("uses the production origin allowlist when configured", () => {
    const env = parseEnv({
      ...baseEnv,
      ...productionServiceEnv,
      CLIENT_ORIGINS: "https://app.loresafe.example,https://admin.loresafe.example",
      NODE_ENV: "production"
    });

    expect(getAllowedCorsOrigins(env)).toEqual([
      "https://app.loresafe.example",
      "https://admin.loresafe.example"
    ]);
  });

  it("falls back to the legacy single production origin", () => {
    const env = parseEnv({
      ...baseEnv,
      ...productionServiceEnv,
      CLIENT_ORIGIN: "https://app.loresafe.example",
      NODE_ENV: "production"
    });

    expect(getAllowedCorsOrigins(env)).toEqual([
      "https://app.loresafe.example"
    ]);
  });

  it("keeps the Vite fallback origin outside production", () => {
    const env = parseEnv({
      ...baseEnv,
      NODE_ENV: "test"
    });

    expect(getAllowedCorsOrigins(env)).toEqual([
      "http://localhost:5173",
      "http://localhost:5174"
    ]);
  });
});
