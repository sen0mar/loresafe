# Live production probes

Run only in `live` mode. Targets: `https://www.loresafe.org` (Vercel, with the
`/api` rewrite) and `https://api.loresafe.org` (Render, direct).

## Allowlist (nothing else is permitted)

1. Unauthenticated `GET`, `HEAD`, and `OPTIONS` requests to public pages, the
   public API, and the R2 public base URL.
2. Unauthenticated `POST` requests that the server must **reject before any
   side effect**, sent with an untrusted `Origin` (for example
   `https://evil.example`) or no `Origin`. If any such request returns a 2xx,
   stop the live run immediately and report it as Critical.
3. Demo account only: exactly one `POST /api/auth/login` and one
   `POST /api/auth/logout` per run, with authenticated `GET` requests between
   them. Credentials come from the `DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD`
   environment variables in the shell; if they are not set, ask the user to
   export them and skip the demo steps. Never read them from `.env` files and
   never write them to disk, logs, or the report.

Forbidden: signup, password reset/forgot, verification resend, any other
mutation, requests to other users' private resources by guessing IDs, fuzzing,
load generation, more than ~60 requests per run, and any action on a non-demo
account. Use `curl -sS -o /dev/null -D -` (headers) or `curl -sS` with a short
`--max-time`. Store the demo session cookie jar in the session scratchpad
directory, never in the repo, and delete it after logout.

## Probes

**Headers and TLS** (both hosts, plus `/api/health` on each)

- HSTS, CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy`, COOP/CORP present and matching the repo values.
- `Cache-Control: private, no-store` on `/api/*`; no `X-Powered-By`.
- HTTP redirects to HTTPS; apex redirects to `www`.

**Origin and CORS** (both hosts — the direct Render host is the important one)

- `POST /api/auth/logout` with `Origin: https://evil.example` → 403.
- `POST /api/auth/logout` with no `Origin` → 403 in production.
- `OPTIONS /api/auth/login` with `Origin: https://evil.example` → no
  `Access-Control-Allow-Origin` echoing the evil origin, and never `*` with
  credentials.

**Proxy trust**

- Send a few `GET /api/public/clubs` to `api.loresafe.org` with varying forged
  `X-Forwarded-For` values and compare the `RateLimit` header. If the remaining
  count resets per forged value, `TRUST_PROXY_CIDRS` lets clients pick their
  own rate-limit bucket — High. Keep this to 3–5 requests.

**Error and info leaks**

- `GET` an unknown `/api/does-not-exist` and a malformed cursor on a public
  list: stable error shape, no stack, no Prisma/SQL text.
- `GET /api/debug/sentry-error` → 404 on both hosts.
- `GET /api/health` / `/api/health/ready`: no connection strings or internal
  versions.

**R2 public bucket** (base URL from the user or `R2_PUBLIC_BASE_URL` in the
shell; skip if unknown)

- `GET <base>/staging/` and `<base>/private/` style paths → denied (403/404),
  and the bucket root does not return a listing.

**Demo account isolation** (between login and logout)

- `GET /api/auth/me` and `GET /api/users/me/clubs`: the demo user is not owner
  or moderator of any club other than the seeded demo clubs. Anything else is
  High (public credentials with elevated rights).
- Auth cookies are `HttpOnly`, `Secure`, `SameSite`, and the response body
  contains no token.
- After logout, `GET /api/auth/me` with the same cookie jar → 401.

**Anonymous spoiler surface**

- `GET /api/public/clubs` and one club detail: only spoiler-safe club metadata,
  no post bodies, no private media URLs.
