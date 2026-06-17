import { describe, expect, it } from "vitest";

import {
  createClientEnvDefineValues,
  publicClientEnvKeys,
  validateClientEnvValues
} from "./vite.config";

describe("Vite environment config", () => {
  it("requires an API base URL for production builds", () => {
    expect(() => validateClientEnvValues("production", {})).toThrow(
      "VITE_API_BASE_URL is required for production builds."
    );
  });

  it("allows local builds to use the API fallback", () => {
    expect(() => validateClientEnvValues("development", {})).not.toThrow();
  });

  it("defines only explicitly public client env keys", () => {
    const defineValues = createClientEnvDefineValues({
      DATABASE_URL: "postgresql://secret",
      JWT_SECRET: "secret",
      R2_SECRET_ACCESS_KEY: "secret",
      UPSTASH_REDIS_REST_TOKEN: "secret",
      VITE_API_BASE_URL: "https://api.threadsync.example",
      VITE_SENTRY_DSN: "https://public@example.ingest.sentry.io/1"
    } as Partial<Record<(typeof publicClientEnvKeys)[number], string>>);

    expect(defineValues).toEqual({
      "import.meta.env.VITE_API_BASE_URL": JSON.stringify(
        "https://api.threadsync.example"
      ),
      "import.meta.env.VITE_SENTRY_DSN": JSON.stringify(
        "https://public@example.ingest.sentry.io/1"
      )
    });
    expect(Object.keys(defineValues)).not.toEqual(
      expect.arrayContaining([
        "import.meta.env.DATABASE_URL",
        "import.meta.env.JWT_SECRET",
        "import.meta.env.R2_SECRET_ACCESS_KEY",
        "import.meta.env.UPSTASH_REDIS_REST_TOKEN"
      ])
    );
  });
});
