import { describe, expect, it } from "vitest";

import {
  addDemoSeedEnvFallbacks,
  createClientEnvDefineValues,
  publicClientEnvKeys
} from "./vite.config";

describe("Vite environment config", () => {
  it("defines only explicitly public client env keys", () => {
    const defineValues = createClientEnvDefineValues({
      DATABASE_URL: "postgresql://secret",
      JWT_SECRET: "secret",
      R2_SECRET_ACCESS_KEY: "secret",
      UPSTASH_REDIS_REST_TOKEN: "secret",
      VITE_API_BASE_URL: "https://api.loresafe.example",
      VITE_DEMO_USER_EMAIL: "guest@example.com",
      VITE_DEMO_USER_PASSWORD: "public-demo-password",
      VITE_PUBLIC_SITE_ORIGIN: "https://www.loresafe.org",
      VITE_SENTRY_DSN: "https://public@example.ingest.sentry.io/1"
    } as Partial<
      Record<(typeof publicClientEnvKeys)[number] | "VITE_API_BASE_URL", string>
    >);

    expect(defineValues).toEqual({
      "import.meta.env.VITE_SENTRY_DSN": JSON.stringify(
        "https://public@example.ingest.sentry.io/1"
      ),
      "import.meta.env.VITE_DEMO_USER_EMAIL":
        JSON.stringify("guest@example.com"),
      "import.meta.env.VITE_DEMO_USER_PASSWORD": JSON.stringify(
        "public-demo-password"
      ),
      "import.meta.env.VITE_PUBLIC_SITE_ORIGIN": JSON.stringify(
        "https://www.loresafe.org"
      )
    });
    expect(Object.keys(defineValues)).not.toEqual(
      expect.arrayContaining([
        "import.meta.env.DATABASE_URL",
        "import.meta.env.JWT_SECRET",
        "import.meta.env.R2_SECRET_ACCESS_KEY",
        "import.meta.env.UPSTASH_REDIS_REST_TOKEN",
        "import.meta.env.VITE_API_BASE_URL"
      ])
    );
  });

  it("uses existing demo seed credentials when public overrides are absent", () => {
    expect(
      addDemoSeedEnvFallbacks(
        {},
        {
          DEMO_USER_EMAIL: "seeded-demo@example.com",
          DEMO_USER_PASSWORD: "seeded-demo-password"
        }
      )
    ).toMatchObject({
      VITE_DEMO_USER_EMAIL: "seeded-demo@example.com",
      VITE_DEMO_USER_PASSWORD: "seeded-demo-password"
    });
  });

  it("prefers explicit public demo credentials over seed fallbacks", () => {
    expect(
      addDemoSeedEnvFallbacks(
        {
          VITE_DEMO_USER_EMAIL: "public-demo@example.com",
          VITE_DEMO_USER_PASSWORD: "public-demo-password"
        },
        {
          DEMO_USER_EMAIL: "seeded-demo@example.com",
          DEMO_USER_PASSWORD: "seeded-demo-password"
        }
      )
    ).toMatchObject({
      VITE_DEMO_USER_EMAIL: "public-demo@example.com",
      VITE_DEMO_USER_PASSWORD: "public-demo-password"
    });
  });
});
