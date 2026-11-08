# Authentication and Access

[Context index](../README.md). Browser cache/session transitions: [client data flow](client-data-flow.md); HTTP semantics: [API governance](../engineering/api-governance.md).

## Authentication

- The optional one-click demo action uses the normal login endpoint and auth
  state transition. Its build-time browser credentials are intentionally public,
  must belong only to an isolated seeded demo account, and leave the action
  hidden when either value is missing or invalid. Local web builds fall back to
  the guarded demo-seed credentials when explicit public overrides are absent.
- Signup creates an unverified account without a session and always returns the
  same accepted response for new and existing email addresses when the requested
  username is available, after comparable Argon2id work. Taken usernames return
  the same conflict for either email state, including the email owner’s own
  username. Uniqueness races recheck the name reservation instead of trusting
  which conflicting constraint PostgreSQL reports first. Login rejects
  unverified accounts with the generic credential response.
- Resend-verification and forgot-password requests return the same accepted response for eligible and ineligible accounts.
- Email verification and password recovery use SHA-256 hashes of
  cryptographically random, expiring, single-use tokens. Verification and reset
  replay are idempotent successes only for the token's original purpose. Token
  lookups enforce purpose before replay handling; wrong-purpose, invalid, or
  expired links use one generic link error.
- Successful browser verification and password reset replace the current
  history entry without token query parameters; unsuccessful attempts retain
  the link for retry. Other query parameters remain intact.
- Successful password reset changes the Argon2id hash, increments the session
  version, and revokes every persisted session in the same transaction.
- Email delivery is owned by the narrow `EmailDelivery` integration boundary.
  Until a provider is approved and configured, the default adapter performs no
  external delivery and never logs or returns raw tokens.
- Password hashing: Argon2id.
- Login result: a short-lived signed access JWT plus a rotating opaque refresh token, both stored in scoped HttpOnly, Secure, SameSite cookies.
- Access JWTs include a minimal user/session version payload plus validated issuer, audience, subject, timestamps, and a unique session identifier.
- PostgreSQL stores only SHA-256 hashes of access-session and refresh-token identifiers, with expiry and revocation timestamps for per-device and all-session revocation.
- Logout revokes the current persisted session before clearing both cookies; logout-all revokes every current user session.
- Permanent account deletion also clears both scoped session cookies and disconnects
  the user's local live-event connections after the deletion commits.
- Access-token verification accepts the current signing key and one explicitly configured previous key during a bounded rotation window. Refresh rotation invalidates the previous refresh token and access-session identifier.
- Each device session has a refresh-token family ID and monotonic generation.
  Rotation retains a hashed spent-token tombstone for 24 hours. A repeated
  request within five seconds is denied without revoking the family to tolerate
  a legitimate parallel retry; later reuse revokes the complete family,
  disconnects local live events, and persists a security event and account
  notification.
- Do not trust roles, progress, or membership from the JWT; load fresh authorization data from PostgreSQL.
- Password change should invalidate existing access and refresh sessions through the user/session version and persisted session revocation.
- Permanent account deletion requires current-password reauthentication and
  rejects stale session versions; the deletion transaction increments the
  session version before destructive writes and anonymizes audit actor
  snapshots before removing the user.

## Authorization

- Initial roles: owner, moderator, member.
- Strategy: policy-based checks in backend modules.
- Scope: club-scoped access control.
- Important policies: can view club, can join club, can manage club, can create post, can view post, can view comment, can reveal locked content, can moderate report, can upload media.
- Active club bans are hard backend denials for all club-scoped reads and writes, including direct content routes, discovery, invites, uploads, moderation, and dashboard data.
- Progress checks compare the member's trusted current progress/mode with the content's required milestone/order.

## Collaboration Model

- Clubs can be public, private, or invite-only.
- Content is shared inside clubs, but each user receives a personalized spoiler-safe view.
- Public discovery may expose only spoiler-safe club metadata.

## Safe Search

- Post search matches and ranks one reader-safe document: club title/link name,
  plus post title/body only when progress permits normal reading. Missing progress
  is unsafe; Brave mode requires the same progress as Strict for search. Locked
  discovery uses only safe club metadata. The final authorization read includes
  the pagination lookahead and discards a page if a protected-text candidate loses
  access, preserving DTO redaction without exposing stale matches or ranking.

## Diagnostic Redaction

- Browser and API Sentry hooks share a dependency-free scrubber owned by API
  core monitoring; the browser adapter imports only that pure module. Errors,
  breadcrumbs, transactions, and spans redact token query values, invite paths,
  referrers, signed URLs, sensitive keys, and nested SDK fields before sending.
  Raw request bodies are omitted, including SDK-normalized request metadata.
  Structured API logs apply the same URL policy. SDK upgrades must preserve the
  synthetic outbound-envelope regressions; `sendDefaultPii: false` alone does
  not protect application bearer links.

Retention and deletion disclosure are owned by [the privacy inventory](../operations/privacy-data-inventory.md) and [the operations runbook](../operations/runbook.md#privacy-and-audit-retention).
