# Injection and XSS

## SQL

- Raw SQL must use Prisma tagged templates (`$queryRaw` / `$executeRaw` as
  tagged templates, `Prisma.sql`). Zero hits expected for `$queryRawUnsafe`,
  `$executeRawUnsafe`, or `Prisma.raw(` outside `apps/api/src/generated`.
- In files that use raw SQL (search, dashboard, notifications, audit, users,
  uploads, auth-session, email-identity, readiness, the `*-authorization-lock`
  files), confirm no string concatenation or template interpolation builds SQL
  outside a tagged template, and dynamic `ORDER BY`/column names come from a
  fixed allowlist.
- Full-text search input goes through `plainto_tsquery`/`websearch_to_tsquery`
  (or equivalent), never a hand-built `to_tsquery` string.

## Input validation

- Every controller validates `params`, `query`, and `body` with Zod before use.
  Flag handlers reading `req.body`/`req.query` fields without a schema parse.
- Schemas bound string length and array size; IDs are validated as the expected
  format; cursors are opaque and rejected when tampered.

## Browser XSS (`apps/web/src`)

- Zero hits expected for `dangerouslySetInnerHTML`, `innerHTML =`,
  `insertAdjacentHTML`, `eval(`, `new Function(`.
- If user content is rendered as Markdown or rich text, confirm raw HTML is
  disabled or sanitized.
- `href`/`src` built from user data (profile links, club links, media URLs,
  notification links) must reject `javascript:` and `data:` schemes and use
  relative app paths or an allowlist.
- Redirect targets after login/verify/reset (for example a `next` or
  `redirect` query param) must be same-origin relative paths only.

## Other sinks

- No `child_process`, `fs` path building, or dynamic `import()` from request
  data in `apps/api/src`.
- Prototype pollution: no deep merge of request bodies into objects.
