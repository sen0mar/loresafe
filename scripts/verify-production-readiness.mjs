import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const readJson = async (path) =>
  JSON.parse(await readFile(new URL(path, root), "utf8"));
const readText = (path) => readFile(new URL(path, root), "utf8");

const manifest = await readJson("infra/operations/production-readiness.json");
const [alerts, synthetics, runbook, vercel] = await Promise.all([
  readText("infra/monitoring/alerts.yaml"),
  readText("infra/monitoring/synthetic-checks.yaml"),
  readText("context/operations-runbook.md"),
  readJson("apps/web/vercel.json")
]);

const fail = (message) => {
  throw new Error(`Production readiness verification failed: ${message}`);
};

if (manifest.version !== 1) fail("unsupported manifest version");
for (const alertName of manifest.requiredAlertRules) {
  if (!alerts.includes(`name: ${alertName}`))
    fail(`missing alert ${alertName}`);
}
for (const path of [manifest.readinessPath, manifest.metricsPath]) {
  if (!synthetics.includes(path) && !runbook.includes(path)) {
    fail(`missing operational endpoint documentation for ${path}`);
  }
}
if (!runbook.includes("point-in-time recovery")) fail("PITR is undocumented");
if (!runbook.includes("restore drill quarterly"))
  fail("restore drills are undocumented");

const configuredHeaders = new Set(
  (vercel.headers ?? [])
    .flatMap((entry) => entry.headers ?? [])
    .map((header) => String(header.key).toLowerCase())
);
for (const header of manifest.requiredSecurityHeaders) {
  if (!configuredHeaders.has(header))
    fail(`missing deployment header ${header}`);
}

if (process.env.PRODUCTION_READINESS_LIVE === "1") {
  const origin = process.env.PRODUCTION_ORIGIN;
  const operationsToken = process.env.OPERATIONS_BEARER_TOKEN;
  const restoreDrillDate = process.env.LAST_RESTORE_DRILL_DATE;
  if (!origin || !operationsToken || !restoreDrillDate) {
    fail(
      "live verification requires PRODUCTION_ORIGIN, OPERATIONS_BEARER_TOKEN, and LAST_RESTORE_DRILL_DATE"
    );
  }

  const drillAgeDays =
    (Date.now() - new Date(`${restoreDrillDate}T00:00:00Z`).getTime()) /
    86_400_000;
  if (!Number.isFinite(drillAgeDays) || drillAgeDays < 0)
    fail("invalid restore drill date");
  if (drillAgeDays > manifest.backup.restoreDrillMaximumAgeDays) {
    fail(`restore drill evidence is ${Math.floor(drillAgeDays)} days old`);
  }

  const readinessResponse = await fetch(
    new URL(manifest.readinessPath, origin),
    {
      signal: AbortSignal.timeout(5_000)
    }
  );
  if (!readinessResponse.ok)
    fail(`readiness returned ${readinessResponse.status}`);
  for (const header of manifest.requiredSecurityHeaders) {
    if (!readinessResponse.headers.has(header))
      fail(`live response is missing ${header}`);
  }

  const metricsResponse = await fetch(new URL(manifest.metricsPath, origin), {
    headers: { authorization: `Bearer ${operationsToken}` },
    signal: AbortSignal.timeout(5_000)
  });
  if (!metricsResponse.ok) fail(`metrics returned ${metricsResponse.status}`);
  const metrics = await metricsResponse.text();
  if (!metrics.includes("loresafe_"))
    fail("metrics payload is empty or unexpected");
}

console.log(
  process.env.PRODUCTION_READINESS_LIVE === "1"
    ? "Production readiness configuration and live evidence are valid."
    : "Production readiness configuration is valid; run with PRODUCTION_READINESS_LIVE=1 to verify deployed evidence."
);
