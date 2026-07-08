# LoreSafe Agent Context

Read these before implementation:

1. `context/project-overview.md` — product, MVP scope, users, and success criteria.
2. `context/architecture-context.md` — stack, system boundaries, auth, storage, APIs, and invariants.
3. `context/ui-context.md` — visual reference, theme tokens, layout rules, and styling rules.
4. `context/code-standards.md` — file structure, code style, frontend/backend conventions, and testing.
5. `context/ai-workflow-rules.md` — feature workflow, scoping, docs updates, and handoff rules.
6. `context/features/current-feature.md` — active feature plan.
7. `context/features/feature-history.md` — completed feature summaries.

# Workflow

- Before starting a new feature, create a new feature branch from `main`; if the user explicitly says not to create a branch, skip this workflow and follow the user's instructions.
- After agreeing on the feature scope with the user and before implementation, fill the placeholders in `context/features/current-feature.md`, then ask whether to start implementation.
- After implementation is complete and the user asks to commit and merge into `main`, reset `context/features/current-feature.md` back to placeholders and add a concise entry to `context/features/feature-history.md`.
- Commit messages must use a short title and a concise description of what changed.
- Do not mention routine `current-feature.md` or `feature-history.md` updates in commit messages.

## Dependency Installs

- Package manager install commands require network access and may hang in the default sandbox. For npm install, npm ci, npx, pnpm, yarn, or equivalent dependency-download commands, request escalated permissions up front instead of first trying the sandboxed command.
- If a dependency install produces no output for about 5 seconds, treat it as stuck: stop the stale process, rerun with escalated permissions, and do not leave background install sessions running.
- Prefer installing from the package directory that owns the lockfile, for example client/ for frontend packages.

## Code Style

- Prefer arrow functions assigned to `const` over regular `function` declarations for components, helpers, and callbacks.
- Keep every file focused, readable, and compositional. Build features from reusable components, hooks, data/config modules, and model utilities in folders that match their responsibility instead of placing substantial UI or logic directly in one file. Entrypoints such as `src/App.tsx` should be especially small composition layers.

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
