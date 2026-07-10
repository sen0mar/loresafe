import { describe, expect, it } from "vitest";

import { parseDemoSeedEnv } from "./demo-seed-env.js";

const approvedSeedEnv = {
  NODE_ENV: "development",
  DATABASE_URL: "postgresql://dev:dev@localhost:5432/loresafe_dev",
  DEMO_SEED_DATABASE_URL: "postgresql://dev:dev@localhost:5432/loresafe_dev",
  DEMO_SEED_CONFIRM: "I_UNDERSTAND_THIS_WRITES_DEMO_DATA",
  DEMO_USER_EMAIL: "demo@example.com",
  DEMO_USER_DISPLAY_NAME: "Demo Reader",
  DEMO_USER_PASSWORD: "correct horse battery"
} satisfies NodeJS.ProcessEnv;

describe("demo seed environment", () => {
  it("accepts an explicitly approved development target", () => {
    expect(parseDemoSeedEnv(approvedSeedEnv).DEMO_USER_EMAIL).toBe(
      "demo@example.com"
    );
  });

  it("fails closed in production", () => {
    expect(() =>
      parseDemoSeedEnv({ ...approvedSeedEnv, NODE_ENV: "production" })
    ).toThrow("forbidden");
  });

  it("rejects a database that does not match the approved seed target", () => {
    expect(() =>
      parseDemoSeedEnv({
        ...approvedSeedEnv,
        DATABASE_URL: "postgresql://prod:prod@db.example/loresafe"
      })
    ).toThrow("approve this seed target");
  });

  it("requires the explicit destructive-write confirmation", () => {
    expect(() =>
      parseDemoSeedEnv({ ...approvedSeedEnv, DEMO_SEED_CONFIRM: "yes" })
    ).toThrow();
  });
});
