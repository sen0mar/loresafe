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
- Background jobs: pg-boss backed by PostgreSQL.
- Realtime: Server-Sent Events for lightweight authenticated events.

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
- PostgreSQL — stores normalized application data, metadata, audit logs, and pg-boss jobs.
- PostgreSQL realtime connection — uses a direct/session URL for `LISTEN/NOTIFY`; transaction-pooler URLs are not valid for the SSE transport.
- R2 — stores avatars, covers, and post/comment media; PostgreSQL stores metadata and access rules.
- Upstash Redis — stores rate-limit counters only in the initial architecture.
- External services — accessed through small integration modules.

Boundary rules:

- The backend must decide which content is safe before sending a response.
- React may hide or decorate locked content, but it must not receive unsafe spoiler content.
- Cross-boundary input is treated as unknown until validated.
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
- Cleanup orphaned uploads with a pg-boss job.

Cache, rate-limit, and queue:

- TanStack Query handles client-side API caching.
- Upstash Redis is for rate-limit counters.
- pg-boss handles jobs such as notifications, invite expiry, upload cleanup, prediction reveal, and unlock summaries.
- Jobs must be idempotent where retries are possible.

Storage invariants:

- PostgreSQL is the source of truth for progress, permissions, content visibility, and file metadata.
- Large binaries are not stored in PostgreSQL.
- Required milestone/order must be queryable without loading full timelines into memory.
- Every content response must be filtered or shaped against the authenticated user's club progress and mode.

## Auth and Collaboration Model

Authentication:

- Password hashing: Argon2id.
- Login result: short-lived signed JWT stored in an HttpOnly, Secure, SameSite cookie.
- JWT payload should be minimal: user ID, token version/session version, issued/expiry times.
- Do not trust roles, progress, or membership from the JWT; load fresh authorization data from PostgreSQL.
- Logout clears the cookie. Password change should invalidate existing tokens through a token/session version.

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
- `jobs`
- `events`

Each backend module follows the Express flow: routes → controllers → services → repositories → policies.

## API and Data Flow Model

API style: REST JSON, with SSE for realtime events.

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
6. Unconfirmed files are cleaned by background jobs.

SSE flow:

- Authenticated endpoint streams notification/unlock/moderation events.
- Events contain safe text and IDs only; clients refetch details through normal authorized API endpoints.
- Connections must close cleanly on logout, tab close, and server shutdown.

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
- Debounce networked search/filter controls.
- Use skeletons for feed, cards, panels, and route loads.
- Virtualize only when lists can grow large enough to need it.
- Keep optimistic updates small and easy to roll back.

Backend/database:

- All list endpoints use cursor or page/limit pagination.
- Use Prisma `select` for DTO-shaped responses.
- Avoid loading nested relations unless needed by the route.
- Add indexes for common filters, joins, and ordering paths.
- Run auth, rate limiting, authorization, and validation before expensive work.

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

- The web service start command must run only the built Express server, for example `pnpm --filter @loresafe/api start`.
- Run committed Prisma migrations in a pre-deploy/release command, for example `pnpm --filter @loresafe/api prisma:migrate:deploy`, not in the web start command. This keeps advisory-lock retries from delaying port binding long enough for Render's web-service port scan to fail.

Environment variables must be validated at startup. Required groups:

- App URLs and environment mode.
- Database URLs and migration/deploy credentials.
- A direct/session PostgreSQL events URL for cross-instance SSE delivery.
- JWT/session secrets and cookie settings.
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
- SSE streams leak events after logout or send unsafe notification text.
- Background jobs are retried and create duplicate notifications/actions.
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
