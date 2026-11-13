# HTTP surface, rate limits, and config drift

Rules: `context/engineering/api-governance.md`,
`context/architecture/deployment-and-delivery.md`.

## Rate-limit coverage

`apps/api/src/core/security/rate-limit-routes.ts` is a registry separate from
the routers. Compare them:

1. Build the full list of method + path from the routers mounted in
   `apps/api/src/app.ts`.
2. Build the list of method + path covered by `registerRateLimiters` and
   `registerParsedBodyRateLimiters`.
3. Flag:
   - Any mutation (POST/PATCH/PUT/DELETE) with no limiter — Medium.
   - Any auth route (login, refresh, signup, verification, password) with no
     limiter — High.
   - Any expensive personalized GET (feeds, members, comments, dashboard,
     notifications, moderation lists, search) not on `expensiveReadRateLimiter`
     or a dedicated limiter — Medium.
   - Path mismatches (registry path no longer matches a real route, so the
     limiter silently never fires).
4. Confirm limiters stay registered **before** `express.json()` and
   `cookieParser()` in `app.ts`, except those intentionally in
   `registerParsedBodyRateLimiters`.

## Origin, CORS, proxy

- `core/security/trusted-origin.ts`: unsafe methods require a trusted
  `Origin`; production rejects a missing Origin. Flag any route mounted before
  the middleware in `app.ts`, or any new exemption.
- `config/cors.ts`: production origins come only from
  `CLIENT_ORIGIN_ALLOWLIST` / `CLIENT_ORIGIN`; no wildcard, no reflection.
- `core/security/trusted-proxy.ts`: `TRUST_PROXY_CIDRS` must be explicit
  CIDRs; flag any `trust proxy` set to `true` or a hop count.
- `express.json` body limit stays small (currently `64kb`).

## Headers and drift

- The CSP and security headers are defined twice: `apps/api/src/core/security/security-headers.ts`
  and `apps/web/vercel.json`. Diff them; any difference is Medium.
- Flag CSP weakening in either place: `'unsafe-eval'`, `'unsafe-inline'` in
  `script-src`, wildcard `connect-src`, removed `frame-ancestors 'none'`.
- API responses keep `Cache-Control: private, no-store`; only `/sitemap.xml`
  may be shared-cacheable.
- `infra/cloudflare/r2-cors-production.json`: origins only
  `https://www.loresafe.org`, methods only GET/HEAD/PUT.
- `render.yaml`: no secrets inlined; migrations run in pre-deploy, not start.

## Debug and health

- `modules/debug/debug.routes.ts`: the route must stay disabled when
  `NODE_ENV` is `production` or `test`.
- `modules/health/`: readiness output must not include connection strings,
  versions of internal services, or error messages from dependencies.

## Errors

- `core/http/error-middleware.ts`: production errors return the stable
  `{ error: { code, message, requestId } }` shape with no stack traces, Prisma
  messages, or SQL.
