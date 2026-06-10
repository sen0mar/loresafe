# ThreadSync Agent Context

Read these before implementation:

1. `context/project-overview.md` — product, MVP scope, users, and success criteria.
2. `context/architecture-context.md` — stack, system boundaries, auth, storage, APIs, and invariants.
3. `context/ui-context.md` — visual reference, theme tokens, layout rules, and styling rules.
4. `context/code-standards.md` — file structure, code style, frontend/backend conventions, and testing.
5. `context/ai-workflow-rules.md` — feature workflow, scoping, docs updates, and handoff rules.
6. `context/features/current-feature.md` — active feature plan.
7. `context/features/feature-history.md` — completed feature summaries.

## Hard Rules

- Keep the implementation simple and readable. Avoid clever abstractions, large mixed-purpose files, and long functions/components.
- Backend policies enforce auth, ownership, club roles, bans, and spoiler/progress visibility. Frontend guards are UX only.
- Never return spoiler content, spoiler images, hidden comments, or unsafe notification text to users who are not allowed to see them.
- Prisma schema changes use committed migrations only. Never use `prisma db push`, reset/drop databases, delete migrations, or run destructive SQL unless the user explicitly requests it.
- Use TanStack Query for server state. Use TanStack Store only for small client/UI state; never mirror API data there.
- JWTs live only in HttpOnly secure cookies. Never store auth tokens in `localStorage`/`sessionStorage`.
- Validate request bodies, params, query strings, env vars, and webhooks with Zod before trusting them.
- Never log passwords, hashes, cookies, JWTs, reset links, secrets, R2 credentials, or private signed URLs.
- Uploads go through backend-controlled R2 flows. Store file metadata in PostgreSQL and validate file type, size, ownership, and spoiler access.
- Rate-limit sensitive or expensive routes before expensive parsing, database work, storage work, or external calls.
- Do not add new services, switch libraries, or implement out-of-scope features without updating the context files and getting approval.
