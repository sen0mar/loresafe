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

const requireHeaders = (response, headers, label) => {
  for (const header of headers) {
    if (!response.headers.has(header)) fail(`${label} is missing ${header}`);
  }
};

if (manifest.version !== 1) fail("unsupported manifest version");
for (const alertName of manifest.requiredAlertRules) {
  if (!alerts.includes(`name: ${alertName}`))
    fail(`missing alert ${alertName}`);
}
for (const path of [
  manifest.livenessPath,
  manifest.deepReadinessPath,
  manifest.metricsPath
]) {
  if (!synthetics.includes(path) && !runbook.includes(path)) {
    fail(`missing operational endpoint documentation for ${path}`);
  }
}
if (!runbook.includes("point-in-time recovery")) fail("PITR is undocumented");
if (!runbook.includes("restore drill quarterly"))
  fail("restore drills are undocumented");

const documentHeaderRules = (vercel.headers ?? []).filter((entry) => {
  const configuredHeaders = new Set(
    (entry.headers ?? []).map((header) => String(header.key).toLowerCase())
  );

  return manifest.requiredSecurityHeaders.every((header) =>
    configuredHeaders.has(header)
  );
});
if (documentHeaderRules.length !== 1) {
  fail("expected one complete frontend document header rule");
}
const documentHeaderSource = documentHeaderRules[0].source;
const documentHeaderMatcher = new RegExp(`^${documentHeaderSource}$`);
for (const path of ["/", "/login", "/app/clubs"]) {
  if (!documentHeaderMatcher.test(path))
    fail(`deployment headers do not match document path ${path}`);
}
for (const path of [
  "/api/health",
  "/api/not-found",
  "/sitemap.xml",
  "/icon.svg",
  "/assets/index.js"
]) {
  if (documentHeaderMatcher.test(path))
    fail(`frontend document headers incorrectly match ${path}`);
}

const documentOnlyHeaders = [
  "content-security-policy",
  "cross-origin-opener-policy",
  "x-frame-options"
];
const liveDocumentPaths = ["/", "/login", "/app/clubs"];
const liveApiErrorPath = "/api/production-readiness-not-found";
const liveStaticAssetPath = "/icon.svg";

if (process.env.PRODUCTION_READINESS_LIVE === "1") {
  const origin = process.env.PRODUCTION_ORIGIN;
  const operationsToken = process.env.OPERATIONS_BEARER_TOKEN;
  const restoreDrillDate = process.env.LAST_RESTORE_DRILL_DATE;
  if (!origin || !operationsToken || !restoreDrillDate) {
    fail(
      "live verification requires PRODUCTION_ORIGIN, OPERATIONS_BEARER_TOKEN, and LAST_RESTORE_DRILL_DATE"
    );
  }

  const fetchProductionPath = (path, init = {}) =>
    fetch(new URL(path, origin), {
      ...init,
      signal: AbortSignal.timeout(5_000)
    });

  const drillAgeDays =
    (Date.now() - new Date(`${restoreDrillDate}T00:00:00Z`).getTime()) /
    86_400_000;
  if (!Number.isFinite(drillAgeDays) || drillAgeDays < 0)
    fail("invalid restore drill date");
  if (drillAgeDays > manifest.backup.restoreDrillMaximumAgeDays) {
    fail(`restore drill evidence is ${Math.floor(drillAgeDays)} days old`);
  }

  for (const path of liveDocumentPaths) {
    const response = await fetchProductionPath(path);
    if (!response.ok) fail(`${path} returned ${response.status}`);
    requireHeaders(response, manifest.requiredSecurityHeaders, path);
  }

  const livenessResponse = await fetchProductionPath(manifest.livenessPath);
  if (!livenessResponse.ok)
    fail(`liveness returned ${livenessResponse.status}`);
  requireHeaders(
    livenessResponse,
    manifest.requiredSecurityHeaders,
    "liveness"
  );

  const apiErrorResponse = await fetchProductionPath(liveApiErrorPath);
  if (apiErrorResponse.status !== 404)
    fail(
      `${liveApiErrorPath} returned ${apiErrorResponse.status}, expected 404`
    );
  requireHeaders(
    apiErrorResponse,
    manifest.requiredSecurityHeaders,
    "API error response"
  );

  const staticAssetResponse = await fetchProductionPath(liveStaticAssetPath);
  if (!staticAssetResponse.ok)
    fail(`${liveStaticAssetPath} returned ${staticAssetResponse.status}`);
  for (const header of documentOnlyHeaders) {
    if (staticAssetResponse.headers.has(header)) {
      fail(`${liveStaticAssetPath} unexpectedly includes ${header}`);
    }
  }

  const deepReadinessResponse = await fetchProductionPath(
    manifest.deepReadinessPath,
    {
      headers: { authorization: `Bearer ${operationsToken}` }
    }
  );
  if (!deepReadinessResponse.ok)
    fail(`deep readiness returned ${deepReadinessResponse.status}`);

  const metricsResponse = await fetchProductionPath(manifest.metricsPath, {
    headers: { authorization: `Bearer ${operationsToken}` }
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
