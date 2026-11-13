# Auth flows, sessions, and redaction

Rules: `context/architecture/auth-and-access.md`. Code:
`apps/api/src/modules/auth/`, `apps/api/src/core/security/session-token.ts`,
`password.ts`, `apps/api/src/core/monitoring/telemetry-scrubbing.ts`,
`apps/api/src/core/logging/logger.ts`.

## Enumeration

- Signup, resend-verification, and forgot-password return identical responses
  (status, body, comparable timing via Argon2id work) for existing and
  non-existing emails. Login stays generic for unverified accounts.
- Username conflicts return the same conflict regardless of email state.

## Tokens

- Verification/reset tokens: cryptographically random, stored as SHA-256
  hashes, expiring, single-use, purpose-checked before replay handling.
- Access JWT: issuer, audience, subject, expiry, session ID validated; algorithm
  pinned (no `none`, no algorithm taken from the header); previous signing key
  accepted only during the configured rotation window.
- Refresh rotation: reuse after the 5-second grace window revokes the whole
  family and records a security event.
- No token, hash, reset link, or cookie value appears in a JSON response body,
  log call, Sentry event, or error message.

## Cookies

- Session cookies are HttpOnly, Secure in production, SameSite set, scoped
  path. No auth value in `localStorage`/`sessionStorage` in `apps/web/src`.

## Revocation

- Password change and reset increment the session version and revoke all
  persisted sessions in the same transaction.
- Logout revokes the current session before clearing cookies; logout-all
  revokes all.
- Account deletion requires current-password reauthentication.

## Redaction

- `telemetry-scrubbing.ts` covers token query values, invite paths, signed
  URLs, referrers, and sensitive keys. If a new route introduces a bearer-style
  URL (new token param, new invite or share path), confirm the scrubber and its
  tests cover it.
- Logger redacts headers (`cookie`, `authorization`, `set-cookie`) and does not
  log request bodies.

## Passwords

- Argon2id parameters not weakened; minimum length enforced by Zod; password
  never logged or returned.
