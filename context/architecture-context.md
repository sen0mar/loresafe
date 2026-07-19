# Architecture Context

## Stack

Application type: progress-aware social discussion web app.

Frontend:

- Framework/runtime: React.
- Language: TypeScript.
- Routing: React Router.
- Styling/UI: Tailwind CSS + shadcn/ui.
- Server state: TanStack Query.
- Client/UI state: TanStack Store only for small global UI state.
- Forms and validation: Zod schemas; plain React forms first, React Hook Form only when it clearly simplifies complex forms.
- Build tooling: Vite.

Backend/API:

- Runtime: Node.js.
- Framework: Express.
- Language: TypeScript.
- Validation: Zod.
- Auth/session strategy: Argon2id password hashing + JWT in HttpOnly secure cookies.
- Logging/error tracking: structured logs + Sentry.
- Rate limiting: express-rate-limit + rate-limit-redis + Upstash Redis.
- Deferred work: request-driven transactions plus bounded opportunistic cleanup; no database-polling worker.
- Notification delivery: durable PostgreSQL notifications refreshed on shell mount, browser focus, and notification-surface open.

Data and infrastructure:

- Primary database: PostgreSQL.
- ORM: Prisma.
- Search: PostgreSQL full-text search first.
- File/object storage: Cloudflare R2.
- Monitoring: Sentry.
- Hosting/deployment: TBD; do not assume a serverless-only backend until chosen.

Explicit exclusions for MVP:

- MongoDB or mixed database architecture.
- Redux.
- WebSockets unless live rooms become core.
- Meilisearch/OpenSearch until PostgreSQL search is insufficient.
- External media APIs, billing, AI moderation, and advanced analytics.

## System Boundaries

- Frontend — renders UI, calls the API with credentials, owns optimistic UX and local UI state only.
- API/backend — owns authentication, authorization, progress checks, club policies, validation, and response shaping.
- PostgreSQL — stores normalized application data, metadata, audit logs, notifications, and durable storage-deletion records.
- R2 — stores avatars, covers, and post/comment media; PostgreSQL stores metadata and access rules.
- Upstash Redis — stores rate-limit counters only in the initial architecture.
- External services — accessed through small integration modules.

Boundary rules:

- The backend must decide which content is safe before sending a response.
- React may hide or decorate locked content, but it must not receive unsafe spoiler content.
- Cross-boundary input is treated as unknown until validated.
- Client `x-request-id` values are correlation labels only. The API accepts
  1-64 character trace-compatible tokens made from letters, digits, `.`, `_`,
  `:`, and `-`; it generates a server UUID for missing or invalid values.
- Storage object keys and URLs must not become authorization shortcuts.

## Storage Model

Primary model areas:

- Users, auth records, and profile fields.
- Clubs, club settings, rules, visibility, invites, and memberships.
- Roles and club-scoped moderation permissions.
- Milestones and milestone templates.
- User progress and progress history.
- Posts, comments, post types, required milestones, and moderation status.
- Reactions, predictions, notifications, reports, audit logs, and files.

File/object storage:

- Use R2 for binary objects.
- Store metadata in PostgreSQL: owner, club, related post/comment, object key, mime type, size, visibility, spoiler requirement, upload status, and timestamps.
- Use backend-issued presigned upload URLs.
- Avatars and club covers may be public-safe after validation.
- Post/comment media that may contain spoilers must be private or served only after backend authorization.
- Reconcile orphaned uploads in bounded batches during real upload traffic, at most once per API process every six hours.

Cache, rate-limit, and deferred work:

- TanStack Query handles client-side API caching.
- Upstash Redis is for rate-limit counters.
- Comment and progress-unlock notifications are persisted atomically in their owning transactions with deterministic unique event keys.
- R2 deletion records remain durable; committed deletions are attempted after the transaction and retried in a bounded batch during later real upload traffic.
- No timer, cron, startup initializer, or reconnect loop may query PostgreSQL in the Free-plan deployment.

Storage invariants:

- PostgreSQL is the source of truth for progress, permissions, content visibility, and file metadata.
- Large binaries are not stored in PostgreSQL.
- Required milestone/order must be queryable without loading full timelines into memory.
- Every content response must be filtered or shaped against the authenticated user's club progress and mode.

## Auth and Collaboration Model

Authentication:

- Password hashing: Argon2id.
- Login result: a short-lived signed access JWT plus a rotating opaque refresh token, both stored in scoped HttpOnly, Secure, SameSite cookies.
- Access JWTs include a minimal user/session version payload plus validated issuer, audience, subject, timestamps, and a unique session identifier.
- PostgreSQL stores only SHA-256 hashes of access-session and refresh-token identifiers, with expiry and revocation timestamps for per-device and all-session revocation.
- Logout revokes the current persisted session before clearing both cookies; logout-all revokes every current user session.
- Access-token verification accepts the current signing key and one explicitly configured previous key during a bounded rotation window. Refresh rotation invalidates the previous refresh token and access-session identifier.
- Do not trust roles, progress, or membership from the JWT; load fresh authorization data from PostgreSQL.
- Password change should invalidate existing access and refresh sessions through the user/session version and persisted session revocation.
- Permanent account deletion requires current-password reauthentication and
  rejects stale session versions; the deletion transaction increments the
  session version before destructive writes.

Authorization:

- Initial roles: owner, moderator, member.
- Strategy: policy-based checks in backend modules.
- Scope: club-scoped access control.
- Important policies: can view club, can join club, can manage club, can create post, can view post, can view comment, can reveal locked content, can moderate report, can upload media.
- Active club bans are hard backend denials for all club-scoped reads and writes, including direct content routes, discovery, invites, uploads, moderation, and dashboard data.
- Progress checks compare the member's trusted current progress/mode with the content's required milestone/order.

Collaboration model:

- Clubs can be public, private, or invite-only.
- Content is shared inside clubs, but each user receives a personalized spoiler-safe view.
- Public discovery may expose only spoiler-safe club metadata.

## Feature Module Model

Frontend feature domains:

- `auth`
- `profile`
- `clubs`
- `milestones`
- `progress`
- `feed`
- `posts`
- `comments`
- `notifications`
- `moderation`
- `uploads`

Each frontend feature may contain `api`, `components`, `hooks`, `pages`, `schemas`, `stores`, and `types` folders as needed.

Backend modules mirror domains:

- `auth`
- `users`
- `clubs`
- `milestones`
- `progress`
- `posts`
- `comments`
- `notifications`
- `moderation`
- `uploads`
- `events`

Each backend module follows the Express flow: routes → controllers → services → repositories → policies.

## API and Data Flow Model

API style: REST JSON. A local-only SSE route remains available for explicitly connected clients, but the browser does not open it automatically and the API has no PostgreSQL event transport.

The versioned OpenAPI artifact and compatibility, idempotency, error,
pagination, retry, and deprecation policies are defined in
`context/api-governance.md`.

Normal request flow:

1. UI action calls a feature API wrapper using `fetch` with `credentials: "include"`.
2. Express route applies rate limits where relevant.
3. Controller validates params, query, and body with Zod.
4. Auth middleware attaches trusted user context.
5. Policy checks authorize the action/resource.
6. Service applies business rules.
7. Repository performs bounded Prisma data access.
8. Controller returns a narrow DTO.
9. TanStack Query updates or invalidates the relevant cache.

File upload flow:

1. Client requests an upload intent.
2. Backend validates ownership, club membership, file type, size, and spoiler requirement.
3. Backend creates pending file metadata and returns a presigned upload URL.
4. Client uploads directly to R2.
5. Client confirms upload; backend verifies/marks it complete.
6. Real upload traffic opportunistically reconciles a bounded batch of stale, unconfirmed, or unattached assets.

Notification refresh flow:

- The authenticated shell fetches the unread preview when it mounts.
- Notification queries refetch when the browser regains focus and when the dropdown or page opens.
- Current-browser mutations invalidate affected queries; there is no fixed-interval polling.
- Persisted notification responses remain backend-filtered against current membership, bans, progress, and content visibility.

Expected route groups:

- `/api/auth/*`
- `/api/me/*`
- `/api/clubs/*`
- `/api/clubs/:clubId/milestones/*`
- `/api/clubs/:clubId/progress/*`
- `/api/clubs/:clubId/posts/*`
- `/api/posts/:postId/comments/*`
- `/api/notifications/*`
- `/api/moderation/*`
- `/api/uploads/*`
- `/api/events`

## Performance Model

Frontend:

- Remote data belongs in TanStack Query.
- Forward-only infinite queries retain at most five pages. Feed, comment,
  notification, moderation, search, joined-club, and unlock views therefore
  keep a bounded DOM/data window while users continue loading newer pages.
- Debounce networked search/filter controls.
- Use skeletons for feed, cards, panels, and route loads.
- Virtualize only when lists can grow large enough to need it.
- Keep optimistic updates small and easy to roll back.

Backend/database:

- Growing discovery, joined-club, feed, comment, notification, report, and unlock lists use bounded keyset cursors. Smaller member, ban, and milestone administrative lists may retain page/limit pagination only with the shared maximum-page guard.
- Use Prisma `select` for DTO-shaped responses.
- Avoid loading nested relations unless needed by the route.
- Add indexes for common filters, joins, and ordering paths.
- Run auth, rate limiting, authorization, and validation before expensive work.
- Dashboard statistics use one club-bounded aggregate query. Popular discussion
  ranking considers only visible posts created within the last 30 days before
  aggregating their comments and reactions.

Important query paths/indexes:

- Club feed: `clubId`, moderation status, required milestone order, created time.
- Locked placeholders: `clubId`, required milestone order greater than current progress.
- Membership lookup: `userId + clubId` unique/indexed.
- Progress lookup: `userId + clubId` unique/indexed.
- Comments: `postId`, required milestone order, created time.
- Notifications: `userId`, read state, created time.
- Reports/mod queue: `clubId`, status, created time.
- Invites: token hash, club ID, expiry, revoked state.

## Deployment and Environment Model

- Public frontend domain: `https://www.loresafe.org`.
- Frontend hosting: Vercel static Vite app.
- Backend hosting: Render long-running Node/Express service at `https://api.loresafe.org`, not an edge-only function.
- Browser API calls use same-origin `/api` paths through the Vercel rewrite to the Render API domain.
- Use managed PostgreSQL, Cloudflare R2, Upstash Redis, and Sentry.
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
  dependency audit and full-history Gitleaks scan are repeated during a quiet
  period. Dependabot opens bounded weekly npm workspace and GitHub Actions
  update pull requests; it never merges them automatically.
- CodeQL analyzes JavaScript and TypeScript independently on main/PR events and
  each Wednesday at 04:43 UTC. It is intentionally outside the release-gate
  aggregate so branch protection can require its result separately.
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
  versioned in `context/operations-runbook.md` and `infra/monitoring/`.

Environment variables must be validated when the process that owns them starts.
Required groups:

- App URLs and environment mode.
- A pooled runtime database URL plus a direct/session Prisma migration URL and
  migration/deploy credentials.
- Current/previous JWT signing secrets, issuer/audience, access/session lifetimes, and cookie settings.
- R2 account, bucket, endpoint, access key, and secret.
- Upstash Redis connection details.
- Sentry DSNs.
- Optional email provider once password reset/email verification is implemented.

Prisma drift checks:

- Run `pnpm db:check` before investigating API errors that mention missing
  columns or unknown Prisma fields.
- For the club link-name rename, the committed
  `20260630120000_rename_club_slug_to_link_name` migration is the source of
  truth for `clubs.link_name`.
- Repair drift by applying committed migrations and regenerating Prisma Client;
  never use `prisma db push`.

## Failure Modes to Guard Against

- Client-side-only spoiler filtering leaks unsafe data in API responses.
- JWT contains stale roles/progress and is treated as authorization truth.
- Public R2 URLs expose spoiler images.
- Prisma queries overfetch related data or leak hidden fields.
- Missing indexes make the personalized feed slow.
- Rate limiting reads the wrong IP because proxy settings are wrong.
- Notification refresh returns unsafe text or relies on stale frontend authorization.
- Request retries create duplicate notifications instead of using deterministic event keys.
- Opportunistic cleanup runs from a timer or loses durable deletion records after R2 failures.
- Storage succeeds but metadata fails, or metadata succeeds but storage fails.

## Invariants

1. Backend authorization decides every protected read/write.
2. Spoiler visibility is enforced before data leaves the API.
3. Membership, role, ban, invite, and progress data are loaded from trusted database state.
4. Controllers stay thin; services own business logic; repositories own Prisma access; policies own authorization.
5. API responses are narrow DTOs, not raw Prisma models.
6. List endpoints are bounded and indexed.
7. Secrets, tokens, hashes, cookies, and private URLs are never logged or returned.
8. R2 file access never bypasses club/progress authorization for spoiler media.
9. Sensitive moderation/admin/security actions create audit records.
10. Rate limits protect auth, posting, commenting, reporting, inviting, uploads, progress updates, and expensive reads.
11. Jobs are idempotent or safely retryable.
12. New services or architecture changes require a context update and user approval.
