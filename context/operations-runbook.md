# Operations and Recovery Runbook

## Health and Metrics

- `pnpm production:readiness:check` validates the versioned alert, synthetic,
  backup/recovery, and security-header controls in CI. Before production
  promotion, run it with `PRODUCTION_READINESS_LIVE=1`, `PRODUCTION_ORIGIN`,
  `OPERATIONS_BEARER_TOKEN`, and `LAST_RESTORE_DRILL_DATE=YYYY-MM-DD`; the live
  gate fails when liveness, manually invoked deep readiness, protected metrics, response headers, or restore
  evidence are missing or stale.

- `GET /api/health` is the cheap process liveness probe. It performs no dependency I/O.
- Render and fixed-interval synthetics must probe only `GET /api/health`; continuous probes must never call a database-backed endpoint.
- `GET /api/health/ready` is an explicitly invoked deployment/incident check for PostgreSQL, Upstash Redis, and R2. It wakes suspended dependencies, runs parallel two-second checks, and returns `503` with safe status only when degraded. Do not schedule it on a fixed interval.
- `GET /api/health/metrics` publishes Prometheus text only when the configured `OPERATIONS_BEARER_TOKEN` is supplied as a bearer token. It includes request count/error/duration series, deep-readiness dependency latency, local SSE connection count, and storage-cleanup outcomes.
- Configure the probes and alerts represented by `infra/monitoring/synthetic-checks.yaml` and `infra/monitoring/alerts.yaml` in the selected monitoring platform before production promotion.
- Vercel compresses proxied/static responses at its edge. Do not add application JSON compression unless production header verification shows an uncovered direct-API path and CPU impact is measured.

## Backup, PITR, and Restore

- PostgreSQL production must have provider-managed encrypted daily backups and point-in-time recovery with at least 14 days of retention.
- R2 object versioning or an equivalent recovery policy must retain deleted/overwritten production objects for at least 14 days. PostgreSQL file metadata remains the authorization source of truth.
- Recovery objectives: RPO at most 15 minutes for PostgreSQL and 24 hours for binary objects; RTO at most 4 hours for a regional database restore and API cutover.
- Run a restore drill quarterly into an isolated non-production project. Apply committed migrations, validate row counts and auth/spoiler invariants, verify a sample of public and private objects, record elapsed time, and destroy the drill environment.

## Incident Response

1. Acknowledge the alert, assign an incident lead, and record start time and affected surfaces.
2. Check liveness, invoke deep readiness once, inspect request/error and storage-cleanup metrics, and confirm the latest deployment.
3. Protect data first: disable risky writes when continued processing could widen loss or spoiler exposure.
4. Communicate impact without exposing private content, tokens, object keys, or user identifiers.
5. Recover using the smallest safe rollback or provider failover, then verify auth, progress rewind, locked content, upload, notification refresh, and session-revocation flows.
6. Record timeline, root cause, corrective actions, owners, and due dates within two business days.

## Deployment Rollback

- CI, local development, and Render use the repository-pinned Node runtime. A
  runtime bump updates `.node-version`, all package engine ranges, Render, and
  the release workflow in one change.
- Render builds once per deployment and runs the pre-deploy migration and web
  start command against that build. Promote only commits that passed the release
  gate; Render does not currently promote one immutable artifact across separate
  environments, so compare the deployed commit SHA before smoke testing.
- Production dependency audit policy is zero known advisories at any severity.
  The release gate runs `pnpm audit --prod --audit-level low`. A temporary
  exception requires a tracked owner, runtime-reachability analysis, compensating
  controls, upstream issue, and expiry date; expired exceptions block promotion.
- Keep the last known-good Render build available. Roll back the API artifact/config first when health regresses; do not reverse a committed migration destructively.
- Database changes must remain backward compatible for at least one application rollback. If not, stop promotion and ship a forward repair migration.
- Roll back the matching Vercel deployment when the browser contract is incompatible, then run continuous liveness, one manual deep-readiness check, and a signed-in spoiler-safety smoke check.

## Neon Free-plan Idle Verification

1. Close LoreSafe browser tabs and stop manual API activity.
2. Confirm continuous monitoring requests only `/api/health`.
3. Wait at least seven minutes and confirm Neon changes from Active to Idle.
4. Leave the application unused for one hour and confirm there are no periodic database wake-ups.
5. Open LoreSafe and verify the first database-backed request succeeds after the expected cold wake.
6. Exercise comment and progress notifications, replacement/account deletion cleanup, and focus/open notification refresh.
