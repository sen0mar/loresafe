# Operations and Recovery Runbook

## Health and Metrics

- `GET /api/health` is the cheap process liveness probe. It performs no dependency I/O.
- `GET /api/health/ready` runs parallel two-second checks for PostgreSQL, pg-boss worker state, the PostgreSQL event transport, Upstash Redis, and the R2 bucket. A degraded dependency returns `503` with status only; dependency errors are not exposed.
- `GET /api/health/metrics` publishes Prometheus text only when the configured `OPERATIONS_BEARER_TOKEN` is supplied as a bearer token. It includes request count/error/duration series, readiness/database-query latency, job readiness/failures/age, SSE state/connections, and storage-cleanup outcomes.
- Configure the probes and alerts represented by `infra/monitoring/synthetic-checks.yaml` and `infra/monitoring/alerts.yaml` in the selected monitoring platform before production promotion.
- Vercel compresses proxied/static responses at its edge. Do not add application JSON compression unless production header verification shows an uncovered direct-API path and CPU impact is measured.

## Backup, PITR, and Restore

- PostgreSQL production must have provider-managed encrypted daily backups and point-in-time recovery with at least 14 days of retention.
- R2 object versioning or an equivalent recovery policy must retain deleted/overwritten production objects for at least 14 days. PostgreSQL file metadata remains the authorization source of truth.
- Recovery objectives: RPO at most 15 minutes for PostgreSQL and 24 hours for binary objects; RTO at most 4 hours for a regional database restore and API cutover.
- Run a restore drill quarterly into an isolated non-production project. Apply committed migrations, validate row counts and auth/spoiler invariants, verify a sample of public and private objects, record elapsed time, and destroy the drill environment.

## Incident Response

1. Acknowledge the alert, assign an incident lead, and record start time and affected surfaces.
2. Check liveness, readiness dependency statuses, request/error metrics, job failures, and the latest deployment.
3. Protect data first: disable risky writes or the affected worker when continued processing could widen loss or spoiler exposure.
4. Communicate impact without exposing private content, tokens, object keys, or user identifiers.
5. Recover using the smallest safe rollback or provider failover, then verify auth, progress rewind, locked content, upload, notification, and SSE revocation flows.
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
- Roll back the matching Vercel deployment when the browser contract is incompatible, then run the liveness/readiness synthetics and a signed-in spoiler-safety smoke check.
- Re-enable workers only after the API and database schema are compatible and idempotent queued jobs have been sampled successfully.
