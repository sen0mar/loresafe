import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { parseShowcaseSeedEnv } from "./showcase-seed-env.js";

const endpointId = "ep-showcase-example-123456";
const approvedEnv = {
  NODE_ENV: "development",
  DATABASE_URL: `postgresql://showcase:secret@${endpointId}-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require`,
  DIRECT_URL: `postgresql://showcase:secret@${endpointId}.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require`,
  SHOWCASE_SEED_CONFIRM:
    "I_UNDERSTAND_THIS_WRITES_SHOWCASE_DATA_TO_AN_EMPTY_DATABASE",
  SHOWCASE_SEED_NEON_ENDPOINT_ID: endpointId,
  SHOWCASE_INVITE_TOKEN: randomBytes(32).toString("base64url"),
  SHOWCASE_RECRUITER_EMAIL: "recruiter@example.com",
  SHOWCASE_USER_PASSWORD: "correct horse battery"
} satisfies NodeJS.ProcessEnv;

describe("showcase seed environment", () => {
  it("accepts an explicitly approved development target", () => {
    expect(parseShowcaseSeedEnv(approvedEnv)).toMatchObject({
      NODE_ENV: "development",
      showcaseDatabaseUrl: approvedEnv.DIRECT_URL
    });
  });

  it("accepts an explicitly approved production target", () => {
    expect(
      parseShowcaseSeedEnv({ ...approvedEnv, NODE_ENV: "production" }).NODE_ENV
    ).toBe("production");
  });

  it("rejects test and unspecified environments", () => {
    expect(() =>
      parseShowcaseSeedEnv({ ...approvedEnv, NODE_ENV: "test" })
    ).toThrow();
  });

  it("requires the exact showcase confirmation", () => {
    expect(() =>
      parseShowcaseSeedEnv({ ...approvedEnv, SHOWCASE_SEED_CONFIRM: "yes" })
    ).toThrow();
  });

  it("requires a showcase invite token", () => {
    const { SHOWCASE_INVITE_TOKEN: _inviteToken, ...missingTokenEnv } =
      approvedEnv;

    expect(() => parseShowcaseSeedEnv(missingTokenEnv)).toThrow();
  });

  it("rejects weak showcase invite tokens", () => {
    expect(() =>
      parseShowcaseSeedEnv({
        ...approvedEnv,
        SHOWCASE_INVITE_TOKEN: "A".repeat(43)
      })
    ).toThrow("strongly random token");
  });

  it("accepts a freshly generated showcase invite token", () => {
    const inviteToken = randomBytes(32).toString("base64url");

    expect(
      parseShowcaseSeedEnv({
        ...approvedEnv,
        SHOWCASE_INVITE_TOKEN: inviteToken
      }).SHOWCASE_INVITE_TOKEN
    ).toBe(inviteToken);
  });

  it("rejects a different approved endpoint", () => {
    expect(() =>
      parseShowcaseSeedEnv({
        ...approvedEnv,
        SHOWCASE_SEED_NEON_ENDPOINT_ID: "ep-production-example"
      })
    ).toThrow("approved Neon endpoint ID");
  });

  it("rejects non-Neon and pooled direct targets", () => {
    expect(() =>
      parseShowcaseSeedEnv({
        ...approvedEnv,
        DIRECT_URL: "postgresql://showcase:secret@db.example.com/neondb"
      })
    ).toThrow("must target a Neon database");

    expect(() =>
      parseShowcaseSeedEnv({
        ...approvedEnv,
        DIRECT_URL: approvedEnv.DATABASE_URL
      })
    ).toThrow("direct Neon endpoint");
  });
});
