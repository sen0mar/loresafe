import { describe, expect, it } from "vitest";

import {
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
      VITE_PUBLIC_SITE_ORIGIN: "https://loresafe-web.vercel.app",
      VITE_SENTRY_DSN: "https://public@example.ingest.sentry.io/1"
    } as Partial<
      Record<(typeof publicClientEnvKeys)[number] | "VITE_API_BASE_URL", string>
    >);

    expect(defineValues).toEqual({
      "import.meta.env.VITE_SENTRY_DSN": JSON.stringify(
        "https://public@example.ingest.sentry.io/1"
      ),
      "import.meta.env.VITE_PUBLIC_SITE_ORIGIN": JSON.stringify(
        "https://loresafe-web.vercel.app"
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
});
