import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repositoryFile = (path: string) =>
  fileURLToPath(new URL(`../../../../${path}`, import.meta.url));

const workflowJob = (workflow: string, jobId: string) => {
  const jobStart = workflow.indexOf(`\n  ${jobId}:`);

  expect(jobStart).toBeGreaterThan(-1);

  const remainingWorkflow = workflow.slice(jobStart + jobId.length + 4);
  const nextJob = remainingWorkflow.match(/\n {2}[a-z0-9-]+:\n/);
  const nextJobStart =
    nextJob?.index === undefined
      ? -1
      : jobStart + jobId.length + 4 + nextJob.index;

  return workflow.slice(
    jobStart,
    nextJobStart === -1 ? workflow.length : nextJobStart
  );
};

describe("production configuration files", () => {
  it("allows R2 browser uploads only from the canonical production origin", async () => {
    const config = JSON.parse(
      await readFile(
        repositoryFile("infra/cloudflare/r2-cors-production.json"),
        "utf8"
      )
    ) as Array<{ AllowedOrigins?: unknown }>;

    expect(config).toHaveLength(1);
    expect(config[0]?.AllowedOrigins).toEqual(["https://www.loresafe.org"]);
  });

  it("never disables Prisma's advisory lock during migration deploys", async () => {
    const script = await readFile(
      repositoryFile("apps/api/scripts/migrate-deploy-with-retry.mjs"),
      "utf8"
    );

    expect(script).not.toContain("PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK");
    expect(script).toContain(
      "release is stopping with the advisory lock enabled"
    );
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

  it("keeps API startup and authenticated browser sessions database-idle", async () => {
    const [server, prismaClient, authenticatedShell, notifications] =
      await Promise.all([
        readFile(repositoryFile("apps/api/src/server.ts"), "utf8"),
        readFile(repositoryFile("apps/api/src/core/prisma/client.ts"), "utf8"),
        readFile(
          repositoryFile(
            "apps/web/src/features/auth/components/authenticated-app-shell.tsx"
          ),
          "utf8"
        ),
        readFile(
          repositoryFile(
            "apps/web/src/features/notifications/api/notifications.ts"
          ),
          "utf8"
        )
      ]);

    expect(server).not.toContain("startNotificationJobs");
    expect(prismaClient).toContain("new Proxy");
    expect(authenticatedShell).not.toContain("EventSource");
    expect(authenticatedShell).not.toContain("useAuthenticatedEvents");
    expect(notifications).toContain("refetchOnWindowFocus: true");
    expect(notifications).not.toContain("refetchInterval");
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
    expect(render).toContain(
      "preDeployCommand: pnpm --filter @loresafe/api prisma:migrate:deploy"
    );
    expect(render).toContain("startCommand: pnpm --filter @loresafe/api start");
    expect(render).toContain("healthCheckPath: /api/health");
    expect(render).not.toContain("healthCheckPath: /api/health/ready");
  });

  it("enforces a zero-advisory production audit and contract validation", async () => {
    const workflow = await readFile(
      repositoryFile(".github/workflows/release-gate.yml"),
      "utf8"
    );

    expect(workflow).toContain("pnpm audit --prod --audit-level low");
    expect(workflow).toContain("pnpm api:contract:check");
  });

  it("runs lint, formatting, coverage, browser, and accessibility gates", async () => {
    const [rootPackage, workflow] = await Promise.all([
      readFile(repositoryFile("package.json"), "utf8"),
      readFile(repositoryFile(".github/workflows/release-gate.yml"), "utf8")
    ]);
    const rootPackageJson = JSON.parse(rootPackage) as {
      devDependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };

    expect(rootPackageJson.scripts?.lint).toContain("eslint");
    expect(rootPackageJson.scripts?.["format:check"]).toBe(
      "prettier --check ."
    );
    expect(rootPackageJson.scripts?.["test:coverage"]).toContain(
      "test:coverage"
    );
    expect(rootPackageJson.scripts?.["test:browser"]).toContain("playwright");
    expect(
      rootPackageJson.devDependencies?.["@axe-core/playwright"]
    ).toBeTruthy();
    expect(workflow).toContain("pnpm lint");
    expect(workflow).toContain("name: Check repository formatting");
    expect(workflow).toContain("pnpm format:check");
    expect(workflow).toContain("pnpm test:coverage:ci");
    expect(workflow).toContain("pnpm test:browser");
    expect(workflow).toContain("playwright install --with-deps chromium");
    expect(workflow).toContain("name: coverage-reports");
  });

  it("keeps release concerns independently visible and aggregates them fail closed", async () => {
    const workflow = await readFile(
      repositoryFile(".github/workflows/release-gate.yml"),
      "utf8"
    );
    const safetyJobs = [
      "secret-scan",
      "static-quality",
      "unit-and-coverage",
      "database-integration",
      "build",
      "browser-accessibility"
    ];
    const aggregate = workflowJob(workflow, "release-gate");

    for (const jobId of safetyJobs) {
      expect(workflow).toContain(`\n  ${jobId}:`);
      expect(aggregate).toContain(`- ${jobId}`);
      expect(aggregate).toContain(`needs.${jobId}.result != 'success'`);
    }

    expect(workflow).not.toContain("\n  verify:");
    expect(workflowJob(workflow, "browser-accessibility")).toContain(
      "needs: [build]"
    );
    expect(aggregate).toContain("if: ${{ always() }}");
    expect(aggregate).not.toContain("toJSON(needs)");
    expect(aggregate).not.toMatch(/run:.*\$\{\{.*needs/);
  });

  it("runs each test tier once and generates Prisma at most once per CI job", async () => {
    const [rootPackage, apiPackage, workflow] = await Promise.all([
      readFile(repositoryFile("package.json"), "utf8"),
      readFile(repositoryFile("apps/api/package.json"), "utf8"),
      readFile(repositoryFile(".github/workflows/release-gate.yml"), "utf8")
    ]);
    const rootScripts = JSON.parse(rootPackage).scripts as Record<
      string,
      string
    >;
    const apiScripts = JSON.parse(apiPackage).scripts as Record<string, string>;
    const unitJob = workflowJob(workflow, "unit-and-coverage");
    const databaseJob = workflowJob(workflow, "database-integration");
    const browserJob = workflowJob(workflow, "browser-accessibility");

    expect(rootScripts["test:coverage:ci"]).toContain("--no-bail");
    expect(apiScripts["test:integration:database:ci"]).not.toContain(
      "prisma:generate"
    );
    expect(unitJob).toContain("pnpm test:coverage:ci");
    expect(unitJob).not.toMatch(/run: pnpm test\s*$/m);
    expect(unitJob).not.toContain("RUN_DATABASE_INTEGRATION_TESTS");
    expect(databaseJob).toContain("pnpm db:check");
    expect(databaseJob).toContain("pnpm test:integration:database:ci");
    expect(browserJob.match(/prisma:generate/g)).toHaveLength(1);
    expect(workflow.match(/pnpm test:integration:database:ci/g)).toHaveLength(
      1
    );
  });

  it("retains failure diagnostics with pinned, attempt-specific artifacts", async () => {
    const workflow = await readFile(
      repositoryFile(".github/workflows/release-gate.yml"),
      "utf8"
    );
    const uploadArtifact =
      "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02";
    const buildJob = workflowJob(workflow, "build");
    const unitJob = workflowJob(workflow, "unit-and-coverage");
    const browserJob = workflowJob(workflow, "browser-accessibility");

    expect(unitJob).toContain(
      "always() && hashFiles('apps/api/coverage/**', 'apps/web/coverage/**') != ''"
    );
    expect(unitJob).toContain(uploadArtifact);
    expect(unitJob).toContain("${{ github.job }}");
    expect(unitJob).toContain("${{ github.run_attempt }}");
    expect(unitJob).toContain("retention-days: 10");

    for (const reportDirectory of ["playwright-report", "test-results"]) {
      expect(browserJob).toContain(
        `(failure() || cancelled()) && hashFiles('${reportDirectory}/**') != ''`
      );
      expect(browserJob).toContain(`path: ${reportDirectory}`);
    }

    expect(browserJob.match(new RegExp(uploadArtifact, "g"))).toHaveLength(2);
    expect(browserJob.match(/retention-days: 10/g)).toHaveLength(2);
    expect(browserJob).toContain("${{ github.job }}");
    expect(browserJob).toContain("${{ github.run_attempt }}");
    expect(buildJob).toContain("apps/api/dist");
    expect(buildJob).toContain("apps/web/dist");
    expect(buildJob).toContain(
      "browser-runtime-${{ github.run_id }}-${{ github.job }}-attempt-${{ github.run_attempt }}"
    );
    expect(browserJob).toContain(
      "browser-runtime-${{ github.run_id }}-build-attempt-${{ github.run_attempt }}"
    );
  });

  it("enforces security headers and production readiness verification", async () => {
    const [vercelSource, workflow, rootPackage, readinessManifest] =
      await Promise.all([
        readFile(repositoryFile("apps/web/vercel.json"), "utf8"),
        readFile(repositoryFile(".github/workflows/release-gate.yml"), "utf8"),
        readFile(repositoryFile("package.json"), "utf8"),
        readFile(
          repositoryFile("infra/operations/production-readiness.json"),
          "utf8"
        )
      ]);
    const vercel = JSON.parse(vercelSource) as {
      headers?: Array<{ headers?: Array<{ key?: string; value?: string }> }>;
    };
    const headers = vercel.headers?.flatMap((entry) => entry.headers ?? []);
    const headerNames = headers?.map((header) => header.key);
    const contentSecurityPolicy = headers?.find(
      (header) => header.key === "Content-Security-Policy"
    )?.value;

    expect(headerNames).toContain("Content-Security-Policy");
    expect(contentSecurityPolicy).toContain("https://*.ingest.sentry.io");
    expect(contentSecurityPolicy).toContain("https://*.ingest.de.sentry.io");
    expect(headerNames).toContain("Strict-Transport-Security");
    expect(headerNames).toContain("X-Content-Type-Options");
    expect(JSON.parse(rootPackage).scripts["production:readiness:check"]).toBe(
      "node scripts/verify-production-readiness.mjs"
    );
    expect(workflow).toContain("pnpm production:readiness:check");
    expect(JSON.parse(readinessManifest).backup.postgresPitrRequired).toBe(
      true
    );
  });
});
