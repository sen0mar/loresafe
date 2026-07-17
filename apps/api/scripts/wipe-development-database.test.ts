import { describe, expect, it } from "vitest";

import { readDevelopmentWipeConfig } from "./wipe-development-database.js";

const endpointId = "ep-development-example-123456";
const approvedWipeEnv = {
  NODE_ENV: "development",
  DATABASE_URL: `postgresql://dev_user:dev_pass@${endpointId}-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require`,
  DIRECT_URL: `postgresql://dev_user:dev_pass@${endpointId}.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require`,
  DEV_DATABASE_WIPE_CONFIRM:
    "I_UNDERSTAND_THIS_PERMANENTLY_DELETES_DEVELOPMENT_DATA",
  DEV_DATABASE_WIPE_NEON_ENDPOINT_ID: endpointId
} satisfies NodeJS.ProcessEnv;

describe("wipe development database script", () => {
  it("accepts matching pooled and direct Neon development targets", () => {
    expect(readDevelopmentWipeConfig(approvedWipeEnv)).toEqual({
      databaseUrl: approvedWipeEnv.DIRECT_URL,
      endpointId
    });
  });

  it("refuses to run outside the development environment", () => {
    expect(() =>
      readDevelopmentWipeConfig({
        ...approvedWipeEnv,
        NODE_ENV: "production"
      })
    ).toThrow("NODE_ENV is exactly development");
  });

  it("requires the exact destructive confirmation", () => {
    expect(() =>
      readDevelopmentWipeConfig({
        ...approvedWipeEnv,
        DEV_DATABASE_WIPE_CONFIRM: "yes"
      })
    ).toThrow("exact destructive confirmation");
  });

  it("requires a separately approved development endpoint ID", () => {
    expect(() =>
      readDevelopmentWipeConfig({
        ...approvedWipeEnv,
        DEV_DATABASE_WIPE_NEON_ENDPOINT_ID: "ep-production-example"
      })
    ).toThrow("does not match the approved Neon endpoint ID");
  });

  it("rejects non-Neon targets", () => {
    expect(() =>
      readDevelopmentWipeConfig({
        ...approvedWipeEnv,
        DIRECT_URL:
          "postgresql://dev_user:dev_pass@db.example.com/neondb?sslmode=require"
      })
    ).toThrow("must target a Neon database");
  });

  it("rejects a pooled destructive connection", () => {
    expect(() =>
      readDevelopmentWipeConfig({
        ...approvedWipeEnv,
        DIRECT_URL: approvedWipeEnv.DATABASE_URL
      })
    ).toThrow("DIRECT_URL must use the direct Neon endpoint");
  });

  it("rejects runtime and direct URLs for different databases", () => {
    expect(() =>
      readDevelopmentWipeConfig({
        ...approvedWipeEnv,
        DIRECT_URL: approvedWipeEnv.DIRECT_URL.replace("/neondb", "/other")
      })
    ).toThrow("must identify the same Neon endpoint, database, and username");
  });
});
