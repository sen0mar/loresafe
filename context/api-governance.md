# API Governance

## Contract ownership

- `apps/api/openapi/openapi.json` is the versioned OpenAPI 3.1 contract for the
  supported REST and SSE surface. Request-body and query schemas are generated
  from the same Zod schemas used by controllers; `x-response-dto` names the
  narrow service/controller DTO that owns each successful response.
- Run `pnpm api:contract:generate` after an intentional contract change and
  commit the generated artifact. `pnpm api:contract:check` and the release gate
  fail when the artifact differs from the Zod-backed generator.
- Every route must declare authentication, success status, error responses,
  idempotency, path/query parameters, and rate-limit behavior before release.

## Authentication and transport

- Browser authentication uses rotating Secure, HttpOnly, SameSite cookies.
  JavaScript clients never receive access or refresh tokens in response JSON.
- State-changing browser requests require a trusted `Origin`; cross-origin API
  callers are not supported without an explicit reviewed CORS/CSRF design.
- `/api/events` is authenticated `text/event-stream`; events carry safe IDs and
  text only, and clients refetch authorized details through REST.

## Pagination

- Growing lists use bounded keyset cursors. `cursor` values are opaque and may
  be used only with the endpoint/filter combination that issued them.
- Responses return a bounded item array and `nextCursor`; a missing/null cursor
  means there is no next page. Invalid or stale cursors return `400 BAD_REQUEST`.
- Small administrative lists may use bounded `page`/`limit` pagination with the
  shared maximum-page guard. Clients must not infer totals unless supplied.

## Errors, retryability, and limits

All JSON errors use `{ "error": { "code", "message", "requestId" } }`. The
request ID is safe to quote to operators. Clients must branch on status/code,
not message text.

| Status | Stable codes                                   | Retry guidance                                                                                       |
| ------ | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 400    | `BAD_REQUEST`                                  | Fix the request; do not retry unchanged.                                                             |
| 401    | `UNAUTHORIZED`                                 | Refresh/re-authenticate once; login failures remain intentionally generic.                           |
| 403    | `FORBIDDEN`, `BANNED`                          | Do not retry without a permission/state change.                                                      |
| 404    | `NOT_FOUND`                                    | Do not retry unless eventual creation is expected.                                                   |
| 409    | `CONFLICT`, `INVITE_EXPIRED`, `INVITE_REVOKED` | Re-read state; retry only when the operation is documented idempotent and the conflict is transient. |
| 429    | `TOO_MANY_REQUESTS`                            | Honor `Retry-After`/`RateLimit`; use jitter and never fan out retries.                               |
| 500    | `INTERNAL_SERVER_ERROR`                        | Retry idempotent requests with bounded exponential backoff.                                          |
| 503    | `SERVICE_UNAVAILABLE`                          | Retry idempotent requests with bounded exponential backoff.                                          |

Rate-limited responses publish the structured `RateLimit` header and may publish
`Retry-After`. Limits are abuse controls, not client quotas, and can tighten
without a contract-version change. Login has both broader IP and normalized,
non-reversible account buckets; responses never reveal which bucket matched.

## Idempotency and HTTP semantics

- GET, PUT, and DELETE are idempotent. Repeating them with identical authorized
  inputs must not create another side effect.
- PATCH is idempotent only where `x-idempotent: true` says so. POST is not
  idempotent unless the contract explicitly marks it or accepts a stable command
  identifier. Upload completion and progress commands preserve retry results.
- New resource state changes prefer standard PUT/PATCH/DELETE. Existing command
  POST routes remain during compatibility migrations; add the standard route,
  migrate first-party clients, deprecate the command route, then remove it only
  in a major API version.
- A future general idempotency-key facility must define key scope, retention,
  request fingerprinting, replay status/body, and concurrent-request behavior
  before advertising the `Idempotency-Key` header.

## Versioning and compatibility

- The current internal contract is API `1.x`. Additive optional response fields,
  new endpoints, new optional request fields, and tighter security/rate limits
  are backward compatible. Clients must ignore unknown response fields.
- Removing/renaming fields or endpoints, changing field meaning/type, making an
  optional field required, weakening idempotency, or changing authorization in a
  way that breaks a documented client requires a new major version or a staged
  compatibility endpoint.
- External clients are not supported until an explicit version selector is
  exposed (prefer `/api/v1`) and contract conformance tests cover it. Never infer
  external stability from the current unversioned `/api` prefix.

## Deprecation process

1. Add the replacement without breaking the old operation and document the
   migration, owner, first-deprecated release, and earliest removal release.
2. Mark the OpenAPI operation `deprecated: true` and return `Deprecation: true`,
   a standards-formatted `Sunset` date, and a `Link` to migration guidance.
3. Keep first-party clients on the replacement for at least one normal release
   cycle and monitor remaining use without logging private identifiers/content.
4. Remove only in the announced major version after the sunset date. Security
   emergencies may accelerate removal with an incident record and user notice.
