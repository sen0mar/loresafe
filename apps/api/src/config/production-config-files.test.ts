import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repositoryFile = (path: string) =>
  fileURLToPath(new URL(`../../../../${path}`, import.meta.url));

describe("production configuration files", () => {
  it("allows R2 browser uploads only from the canonical production origin", async () => {
    const config = JSON.parse(
      await readFile(
        repositoryFile("infra/cloudflare/r2-cors-production.json"),
        "utf8"
      )
    ) as Array<{ AllowedOrigins?: unknown }>;

    expect(config).toHaveLength(1);
    expect(config[0]?.AllowedOrigins).toEqual([
      "https://www.loresafe.org"
    ]);
  });

  it("never disables Prisma's advisory lock during migration deploys", async () => {
    const script = await readFile(
      repositoryFile("apps/api/scripts/migrate-deploy-with-retry.mjs"),
      "utf8"
    );

    expect(script).not.toContain("PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK");
    expect(script).toContain("release is stopping with the advisory lock enabled");
  });

  it("uses separate direct migration and pooled runtime database URLs", async () => {
    const [prismaConfig, prismaClient, productionEnv] = await Promise.all([
      readFile(repositoryFile("apps/api/prisma.config.ts"), "utf8"),
      readFile(repositoryFile("apps/api/src/core/prisma/client.ts"), "utf8"),
      readFile(repositoryFile(".env.production.example"), "utf8")
    ]);

    expect(prismaConfig).toContain('url: env("DIRECT_URL")');
    expect(prismaConfig).not.toContain('url: env("DATABASE_URL")');
    expect(prismaClient).toContain("new PrismaPg(env.DATABASE_URL)");
    expect(productionEnv).toContain("DIRECT_URL=");
  });
});
