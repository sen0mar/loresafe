import { describe, expect, it } from "vitest";

import {
  buildSeedCommand,
  createTruncatePublicTablesSql,
  readDevelopmentResetConfig
} from "./reset-development-database.js";

describe("reset development database script", () => {
  it("refuses to run outside the development environment", () => {
    expect(() =>
      readDevelopmentResetConfig({
        DEV_DATABASE_RESET_DATABASE_URL:
          "postgresql://dev_user:dev_pass@localhost:5432/loresafe_dev",
        NODE_ENV: "production"
      })
    ).toThrow("NODE_ENV is exactly development");

    expect(() =>
      readDevelopmentResetConfig({
        DEV_DATABASE_RESET_DATABASE_URL:
          "postgresql://dev_user:dev_pass@localhost:5432/loresafe_dev",
        NODE_ENV: "test"
      })
    ).toThrow("NODE_ENV is exactly development");
  });

  it("refuses to run without a valid development reset database URL", () => {
    expect(() =>
      readDevelopmentResetConfig({
        NODE_ENV: "development"
      })
    ).toThrow("DEV_DATABASE_RESET_DATABASE_URL");

    expect(() =>
      readDevelopmentResetConfig({
        DEV_DATABASE_RESET_DATABASE_URL: "https://example.com/not-postgres",
        NODE_ENV: "development"
      })
    ).toThrow("valid postgres:// or postgresql:// URL");
  });

  it("builds truncate SQL for public data tables without Prisma migration history", () => {
    const truncateSql = createTruncatePublicTablesSql([
      "users",
      "_prisma_migrations",
      "posts"
    ]);

    expect(truncateSql).toBe(
      'TRUNCATE TABLE "public"."users", "public"."posts" RESTART IDENTITY CASCADE;'
    );
    expect(truncateSql).not.toContain("_prisma_migrations");
  });

  it("uses the development reset URL when running the existing seed", () => {
    const developmentDatabaseUrl =
      "postgresql://dev_user:dev_pass@localhost:5432/loresafe_dev";
    const command = buildSeedCommand(
      developmentDatabaseUrl,
      "/repo/apps/api",
      {
        DATABASE_URL:
          "postgresql://prod_user:prod_pass@db.example.com:5432/loresafe_prod",
        NODE_ENV: "production",
        PATH: "/usr/bin"
      }
    );

    expect(command.command).toBe("pnpm");
    expect(command.args).toEqual(["prisma:seed"]);
    expect(command.options.cwd).toBe("/repo/apps/api");
    expect(command.options.env).toMatchObject({
      DATABASE_URL: developmentDatabaseUrl,
      NODE_ENV: "development",
      PATH: "/usr/bin"
    });
  });
});
