# Authorization, bans, and spoiler visibility

Rules: `context/architecture/auth-and-access.md`. Backend policies are the only
enforcement; frontend guards are UX.

## Route → policy coverage

1. List every router mounted in `apps/api/src/app.ts` and every handler in the
   matching `apps/api/src/modules/*/*.routes.ts`.
2. For each handler, trace controller → service and confirm:
   - Authenticated routes use `loadCurrentUser` + `requireUser` (or document
     why they are anonymous).
   - Club-scoped reads and writes call the module's policy
     (`apps/api/src/modules/*/*.policy.ts`, `spoilers/spoiler.policy.ts`,
     `clubs/club-content.policy.ts`) **before** returning data or mutating.
   - Active club bans deny the request (reads too: discovery, invites, uploads,
     moderation, dashboard, search).
   - Owner/moderator actions check the role from a fresh database read.
3. Flag any new handler with no policy call, and any policy function that
   returns allow on an unexpected/missing state (missing membership, missing
   progress, unknown role, deleted club).

## Trusted data source

- Role, membership, ban, and progress must come from PostgreSQL in the request,
  never from the JWT payload, request body, query, or client-supplied headers.
  Grep services/policies for reads of `req.body.role`, `role` from token
  claims, or progress values taken from input for authorization decisions.

## IDOR

- Every repository lookup by `postId`, `commentId`, `reportId`,
  `notificationId`, `assetId`, `inviteId`, `milestoneId` must also be bound to
  the authorized `clubId` or `userId` (or be followed by a policy check on the
  loaded record's club before any data leaves the service).
- Watch for routes mounted under `/api/posts/:postId` and `/api/comments/...`:
  the club is derived from the record, so confirm the club is loaded and
  authorized, not assumed.

## Spoiler-safe responses

- For each DTO in `apps/api/src/modules/*/*.dto.ts` that can carry post or
  comment title/body, notification text, search snippets, prediction text, or
  media URLs: confirm the producer redacts or replaces it with a locked
  placeholder when progress does not permit reading.
- New fields added to existing DTOs count. A field that copies a raw Prisma
  record or uses object spread (`...post`) into a DTO is a red flag.
- Search (`modules/search/`): post title/body may only be matched/ranked when
  progress permits normal reading; missing progress is unsafe; Brave mode needs
  the same progress as Strict. Confirm the final authorization read still
  covers the pagination lookahead.
- Notifications and SSE (`modules/events/`): events carry safe IDs/text only.

## Tests

- For each policy, confirm a test covers deny for: non-member, banned member,
  insufficient progress, wrong role. Report missing deny tests as Low with the
  suggested test.
