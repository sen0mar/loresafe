import { describe, expect, it } from "vitest";
import { z } from "zod";

import { parseEnv } from "./env.js";

const baseEnv = {
  APP_NAME: "LoreSafe",
  CLIENT_ORIGIN: "http://localhost:5173",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/loresafe",
  DEMO_USER_DISPLAY_NAME: "Demo Reader",
  DEMO_USER_EMAIL: "demo@example.com",
  DEMO_USER_PASSWORD: "correct horse battery",
  JWT_SECRET: "a".repeat(32)
} satisfies NodeJS.ProcessEnv;

const productionServiceEnv = {
  CLIENT_ORIGINS: "https://app.loresafe.example, https://admin.loresafe.example",
  R2_ACCESS_KEY_ID: "r2-access-key",
  R2_ACCOUNT_ID: "r2-account",
  R2_BUCKET_NAME: "loresafe-assets",
  R2_PUBLIC_BASE_URL: "https://cdn.loresafe.example",
  R2_SECRET_ACCESS_KEY: "r2-secret-key",
  SENTRY_DSN: "https://public@example.ingest.sentry.io/1",
  UPSTASH_REDIS_REST_TOKEN: "redis-token",
  UPSTASH_REDIS_REST_URL: "https://redis.example"
} satisfies NodeJS.ProcessEnv;

describe("env validation", () => {
  it("fails loudly in production when service config is missing", () => {
    const issues = getEnvIssueSummary({
      ...baseEnv,
      DATABASE_URL: "",
      JWT_SECRET: "",
      NODE_ENV: "production"
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining("DATABASE_URL"),
        expect.stringContaining("JWT_SECRET"),
        expect.stringContaining("UPSTASH_REDIS_REST_URL"),
        expect.stringContaining("UPSTASH_REDIS_REST_TOKEN"),
        expect.stringContaining("R2_ACCOUNT_ID"),
        expect.stringContaining("R2_ACCESS_KEY_ID"),
        expect.stringContaining("R2_SECRET_ACCESS_KEY"),
        expect.stringContaining("R2_BUCKET_NAME"),
        expect.stringContaining("R2_PUBLIC_BASE_URL"),
        expect.stringContaining("SENTRY_DSN")
      ])
    );
  });

  it("rejects unsafe production cookie overrides", () => {
    const issues = getEnvIssueSummary({
      ...baseEnv,
      ...productionServiceEnv,
      NODE_ENV: "production",
      SESSION_COOKIE_SECURE: "false"
    });

    expect(issues).toContain(
      "SESSION_COOKIE_SECURE: Must not be false in production"
    );
  });

  it("forces production session cookies secure and parses CORS allowlist", () => {
    const env = parseEnv({
      ...baseEnv,
      ...productionServiceEnv,
      NODE_ENV: "production"
    });

    expect(env.SESSION_COOKIE_SECURE).toBe(true);
    expect(env.TRUST_PROXY_HOPS).toBe(1);
    expect(env.PUBLIC_SITE_ORIGIN).toBe("https://loresafe.org");
    expect(env.CLIENT_ORIGIN_ALLOWLIST).toEqual([
      "https://app.loresafe.example",
      "https://admin.loresafe.example"
    ]);
  });

  it("rejects invalid production CORS origins", () => {
    const issues = getEnvIssueSummary({
      ...baseEnv,
      ...productionServiceEnv,
      CLIENT_ORIGINS: "https://app.loresafe.example,not-a-url",
      NODE_ENV: "production"
    });

    expect(issues).toContain("CLIENT_ORIGINS: Invalid origin: not-a-url");
  });

  it("requires an explicit production client origin", () => {
    const { CLIENT_ORIGIN: _clientOrigin, ...envWithoutOrigin } = baseEnv;
    const {
      CLIENT_ORIGINS: _clientOrigins,
      ...servicesWithoutOrigins
    } = productionServiceEnv;
    const issues = getEnvIssueSummary({
      ...envWithoutOrigin,
      ...servicesWithoutOrigins,
      NODE_ENV: "production"
    });

    expect(issues).toContain(
      "CLIENT_ORIGINS: At least one production client origin is required"
    );
  });

  it("keeps development usable without production service credentials", () => {
    const env = parseEnv({
      ...omitClientOrigin(baseEnv),
      NODE_ENV: "development"
    });

    expect(env.NODE_ENV).toBe("development");
    expect(env.CLIENT_ORIGIN).toBe("http://localhost:5173");
    expect(env.CLIENT_ORIGIN_ALLOWLIST).toEqual([]);
    expect(env.PUBLIC_SITE_ORIGIN).toBe("https://loresafe.org");
    expect(env.SESSION_COOKIE_SECURE).toBe(false);
    expect(env.TRUST_PROXY_HOPS).toBe(0);
  });

  it("normalizes the public site origin", () => {
    const env = parseEnv({
      ...baseEnv,
      PUBLIC_SITE_ORIGIN: "https://loresafe.org/"
    });

    expect(env.PUBLIC_SITE_ORIGIN).toBe("https://loresafe.org");
  });
});

const getEnvIssueSummary = (input: NodeJS.ProcessEnv) => {
  try {
    parseEnv(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`
      );
    }

    throw error;
  }

  throw new Error("Expected env parsing to fail.");
};

const omitClientOrigin = (input: typeof baseEnv) => {
  const { CLIENT_ORIGIN: _clientOrigin, ...rest } = input;

  return rest;
};
