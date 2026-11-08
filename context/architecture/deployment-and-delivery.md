# Deployment and Delivery

[Context index](../README.md). Incident/recovery procedures: [operations runbook](../operations/runbook.md); database lifecycle: [data and storage](data-and-storage.md).

- Public frontend domain: `https://www.loresafe.org`.
- Frontend hosting: Vercel static Vite app.
- Backend hosting: Render long-running Node/Express service at `https://api.loresafe.org`, not an edge-only function.
- Browser API calls use same-origin `/api` paths through the Vercel rewrite to the Render API domain.
- Use managed PostgreSQL, Cloudflare R2, Upstash Redis, and Sentry.
- Local development may optionally use Docker Compose for PostgreSQL 16.9; the
  web and API processes remain host-run through pnpm. Docker is not part of the
  Vercel/Render production topology, and developers may instead configure
  another direct PostgreSQL endpoint through their local environment variables.
  The [repository README](../../README.md) owns the operational setup instructions.
- Verify cookie domain, SameSite, Secure, CORS, proxy, and HTTPS behavior before production.
- R2 buckets that receive browser presigned uploads must allow the deployed frontend
  origin, `PUT`, `GET`, `HEAD`, the `Content-Type` request header, and `ETag`
  exposure. The production policy template lives at
  `infra/cloudflare/r2-cors-production.json`.

Render API deployment:

- `render.yaml` is the source of truth for the Render web service, including the
  build, pre-deploy migration, start, liveness, shutdown, and required
  environment configuration. Dashboard changes must be reconciled back into it.
- Node `22.17.1` is pinned in `.node-version`, Render, and CI. Package manifests
  accept only compatible Node 22 releases at or above that patch level.
- The web service start command must run only the built Express server, for example `pnpm --filter @loresafe/api start`.
- Run committed Prisma migrations in a pre-deploy/release command, for example `pnpm --filter @loresafe/api prisma:migrate:deploy`, not in the web start command. This keeps advisory-lock retries from delaying port binding long enough for Render's web-service port scan to fail.
- Configure Prisma CLI commands with `DIRECT_URL`, using a direct/session PostgreSQL
  endpoint. Keep runtime Prisma Client traffic on the pooled `DATABASE_URL`; never
  run Prisma Migrate through a transaction-pooler endpoint.
- Configure `TRUST_PROXY_CIDRS` with explicit ingress proxy addresses/subnets;
  numeric hop counts are not allowed. Verify `req.ip` through both the Vercel
  rewrite and direct API path before release.

Release gate:

- `.github/workflows/release-gate.yml` is the versioned main/PR gate. Static
  quality, risk-based unit coverage, real PostgreSQL integration, production
  builds, browser/accessibility checks, and the full-history secret scan are
  independently visible jobs. A stable `Release gate` aggregate fails unless
  every safety-critical job succeeds.
- The complete release gate also runs each Monday at 03:17 UTC so the production
  dependency audit, full-history Gitleaks scan, and disposable-PostgreSQL
  performance seed/plan check are repeated during a quiet period. Dependabot
  opens bounded weekly npm workspace and GitHub Actions update pull requests;
  it never merges them automatically.
- CodeQL analyzes JavaScript and TypeScript independently on main/PR events and
  each Wednesday at 04:43 UTC. It is intentionally outside the release-gate
  aggregate so branch protection can require its result separately.
- Release gate and CodeQL accept `merge_group` check requests so a future main
  merge queue evaluates the same required checks as pull requests.
- The desired `main` repository ruleset must require pull requests, require the
  current head to be up to date, disable force pushes and branch deletion, and
  grant no routine-development bypass. After successful workflow runs establish
  their contexts, require exactly `Release gate` and
  `Analyze JavaScript and TypeScript`; GitHub may display the latter under its
  workflow as `CodeQL / Analyze JavaScript and TypeScript`. These are versioned
  governance requirements, not evidence that the remote settings are active.
- Every GitHub Action reference must use a reviewed full commit SHA. Keep the
  reviewed release tag in an adjacent comment, including when Dependabot
  proposes an Actions update; floating major-version tags are not accepted.
- Coverage diagnostics are retained after pass or failure. Browser reports and
  test results are retained after browser failure or cancellation. The browser
  job uses its own migrated and seeded PostgreSQL service plus production build
  artifacts produced by the build job.
- The PostgreSQL integration suite runs separately through
  `pnpm test:integration:database` and must use a direct/session database URL.
- Operational liveness/readiness, metrics, alert/synthetic expectations, backup
  retention, restore drills, incident response, and rollback procedures are
  versioned in `context/operations/runbook.md` and `infra/monitoring/`.

Environment variables must be validated when the process that owns them starts.
Required groups:

- App URLs and environment mode.
- A pooled runtime database URL plus a direct/session Prisma migration URL and
  migration/deploy credentials.
- Current/previous JWT signing secrets, issuer/audience, access/session lifetimes, and cookie settings.
- R2 account, bucket, endpoint, access key, and secret.
- Upstash Redis connection details.
- Sentry DSNs.
- Optional approved email-delivery provider adapter for the existing
  verification/recovery boundary.

Database migration safety and drift troubleshooting: [data and storage](data-and-storage.md#migrations).

## Metrics

HTTP metrics use matched Express route templates, collapse unmatched requests into one label, and enforce a hard process-level series cap. Deep-readiness protection, deadlines, caching, and procedures are owned by [the runbook](../operations/runbook.md#health-and-metrics).
