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

  it("pins one compatible Node runtime across packages, CI, and Render", async () => {
    const [rootPackage, apiPackage, webPackage, nodeVersion, workflow, render] =
      await Promise.all([
        readFile(repositoryFile("package.json"), "utf8"),
        readFile(repositoryFile("apps/api/package.json"), "utf8"),
        readFile(repositoryFile("apps/web/package.json"), "utf8"),
        readFile(repositoryFile(".node-version"), "utf8"),
        readFile(repositoryFile(".github/workflows/release-gate.yml"), "utf8"),
        readFile(repositoryFile("render.yaml"), "utf8")
      ]);

    for (const packageJson of [rootPackage, apiPackage, webPackage]) {
      expect(JSON.parse(packageJson).engines.node).toBe(">=22.17.1 <23");
    }

    expect(nodeVersion.trim()).toBe("22.17.1");
    expect(workflow).toContain("node-version: 22.17.1");
    expect(render).toContain("value: 22.17.1");
    expect(render).toContain("preDeployCommand: pnpm --filter @loresafe/api prisma:migrate:deploy");
    expect(render).toContain("startCommand: pnpm --filter @loresafe/api start");
    expect(render).toContain("healthCheckPath: /api/health/ready");
  });

  it("enforces a zero-advisory production audit and contract validation", async () => {
    const workflow = await readFile(
      repositoryFile(".github/workflows/release-gate.yml"),
      "utf8"
    );

    expect(workflow).toContain("pnpm audit --prod --audit-level low");
    expect(workflow).toContain("pnpm api:contract:check");
  });
});
