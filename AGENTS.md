# LoreSafe Agent Guide

Read only documentation relevant to the task; follow links when their details are needed. Do not load all context or feature history by default.

- Implementation workflow and documentation ownership: `context/engineering/workflow.md`.
- Product scope or behavior: `context/product/overview.md`.
- Stack, boundaries, cross-system changes: `context/architecture/overview.md`.
- Auth, permissions, bans, spoiler visibility, search safety, redaction: `context/architecture/auth-and-access.md`.
- Database, migrations, uploads, cleanup, query performance: `context/architecture/data-and-storage.md`.
- Client state, cache/identity transitions, notification refresh: `context/architecture/client-data-flow.md`.
- Hosting, environment, CI, releases: `context/architecture/deployment-and-delivery.md`.
- API contracts, HTTP behavior, pagination, limits: `context/engineering/api-governance.md`.
- Code changes and tests: `context/engineering/code-standards.md`; visual changes: `context/product/ui.md`.
- Operations/recovery: `context/operations/runbook.md`; privacy/retention: `context/operations/privacy-data-inventory.md`.
- Active feature work: `context/features/current-feature.md`; historical decisions only: `context/features/feature-history.md`.

## Critical Rules

- Backend policies enforce auth, ownership, roles, bans, and spoiler/progress visibility before returning content or media. Frontend guards are UX only.
- Use committed Prisma migrations. Never use `prisma db push`, reset/drop databases, delete migrations, or run destructive SQL without explicit user authorization.
- Browser auth tokens stay in Secure HttpOnly cookies; never browser storage. Validate boundary inputs with Zod. Never log secrets or private URLs.
- Keep changes simple, focused, and within approved scope; use the relevant references above for detailed rules.
