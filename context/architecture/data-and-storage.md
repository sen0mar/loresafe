# Data and Storage

[Context index](../README.md). Authorization: [auth and access](auth-and-access.md); repository conventions: [code standards](../engineering/code-standards.md); storage deployment: [deployment](deployment-and-delivery.md).

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
- Use backend-issued presigned upload URLs only for `staging/uploads/` keys.
  Pending metadata records the distinct final key up front; its staging key is
  derived from that key. Only the backend writes sanitized bytes to final keys.
- Public serving must allow only `public/` and deny `staging/` and `private/`.
  Application key separation does not verify the deployed R2 serving policy.
- Avatars and club covers may be public-safe after validation.
- Post/comment media that may contain spoilers must be private or served only after backend authorization.

## Upload Lifecycle

1. Client requests an upload intent.
2. Backend validates ownership, club membership, file type, size, and spoiler requirement.
3. Backend persists the final destination in pending metadata and returns a
   presigned PUT for its separate staging key, outside the public prefix.
4. Client uploads directly to R2 staging.
5. Client confirms upload; backend applies bounded image decode/re-encode and
   strips metadata. Under the asset completion lock, it writes sanitized bytes
   to the backend-only final key, marks the asset ready, attaches it, and queues
   staging deletion. Concurrent/repeated completion never republishes a ready asset.
6. Real upload traffic opportunistically reconciles a bounded batch of stale,
   unconfirmed, or unattached assets. Both keys remain derivable from pending
   metadata after a storage-success/database-rollback failure; invalid upload,
   expiration, and account deletion queue both keys. Cleanup claims the observed
   state before scheduling deletion so a stale pending snapshot cannot delete a
   newly ready asset. Upload expiration is persisted before signing; the signed
   PUT cannot outlive that deadline. Staging deletion stays pending until that
   deadline via the ledger's `notBefore`, including invalid uploads and account
   deletion, so replay before expiry cannot leave an untracked staging object.
7. Pending intents issued before staging deployment must be restarted; existing
   ready assets retain their URLs. Old presigned URLs remain valid until their
   original expiry. Staging read-access configuration remains a separate
   deployment concern; expiration cleanup is bounded and request-driven.

## Transactions and Deferred Cleanup

- Comment and progress-unlock notifications are persisted atomically in their owning transactions with deterministic unique event keys.
- R2 deletion records remain durable; committed deletions are attempted after the transaction and retried in bounded batches during real upload traffic.
- Reconcile orphaned uploads at most once per API process every six hours.
- No timer, cron, startup initializer, or reconnect loop may query PostgreSQL in the Free-plan deployment.
- Retention and audit cleanup limits are owned by [the operations runbook](../operations/runbook.md#privacy-and-audit-retention); data categories and providers by [the privacy inventory](../operations/privacy-data-inventory.md).

## Database Performance

- Pagination rules are owned by [API governance](../engineering/api-governance.md#pagination).
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

PostgreSQL is the source of truth for permissions, progress, visibility, and file metadata. Required milestone/order must be queryable without loading full timelines. Large binaries belong in R2.

## Migrations

Schema changes require committed migrations; never use `prisma db push`, reset/drop databases, delete migrations, or run destructive SQL without explicit user authorization.

### Drift Checks

- Run `pnpm db:check` before investigating API errors that mention missing
  columns or unknown Prisma fields.
- For the club link-name rename, the committed
  `20260630120000_rename_club_slug_to_link_name` migration is the source of
  truth for `clubs.link_name`.
- Repair drift by applying committed migrations and regenerating Prisma Client.
