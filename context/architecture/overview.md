# Architecture Overview

[Context index](../README.md). Product scope: [product overview](../product/overview.md).

## Stack

- **Frontend:** React, TypeScript, React Router, Vite, Tailwind CSS, shadcn/ui. TanStack Query owns server state; TanStack Store is for small UI state only. Use Zod with plain React forms first; React Hook Form only when complex forms justify it.
- **API:** Node.js, Express, TypeScript, Zod, Argon2id passwords, cookie sessions, structured logs, Sentry. Rate limiting uses express-rate-limit + rate-limit-redis + Upstash Redis.
- **Data:** PostgreSQL, Prisma, PostgreSQL full-text search, Cloudflare R2 binaries. Transactions and bounded request-driven cleanup replace database-polling workers. Durable notifications refresh on mount/focus/open.
- **Hosting:** Vercel frontend, Render long-running API; see [deployment](deployment-and-delivery.md).
- **Excluded:** MongoDB/mixed databases, Redux, WebSockets unless live rooms become core, Meilisearch/OpenSearch until PostgreSQL search is insufficient. Product exclusions belong to [MVP scope](../product/overview.md#out-of-scope-for-mvp).

## System Boundaries

- Frontend — renders UI, calls the API with credentials, owns optimistic UX and local UI state only.
- API/backend — owns authentication, authorization, progress checks, club policies, validation, and response shaping.
- PostgreSQL — stores normalized application data, metadata, audit logs, notifications, and durable storage-deletion records.
- R2 — stores avatars, covers, and post/comment media; PostgreSQL stores metadata and access rules.
- Upstash Redis — stores rate-limit counters only in the initial architecture.
- External services — accessed through small integration modules.

## Request Flow

1. UI action calls a feature API wrapper using `fetch` with `credentials: "include"`.
2. Express route applies rate limits where relevant.
3. Controller validates params, query, and body with Zod.
4. Auth middleware attaches trusted user context.
5. Policy checks authorize the action/resource.
6. Service applies business rules.
7. Repository performs bounded Prisma data access.
8. Controller returns a narrow DTO.
9. TanStack Query updates or invalidates the relevant cache.

REST JSON is the primary API. Local-only SSE is available to explicitly connected clients; the browser does not connect automatically, and there is no PostgreSQL event transport.

## Core Invariants

- Backend policies authorize protected reads/writes using fresh database membership, roles, bans, and progress. Unsafe spoiler content, images, comments, and notification text never leave the API.
- Validate boundary inputs with Zod; return narrow DTOs and bounded, indexed lists.
- Storage keys and URLs never bypass authorization.
- Never log or return secrets, hashes, cookies, tokens, reset links, or private signed URLs.
- Sensitive moderation/admin/security actions create audit records; deferred work must be safely retryable.
- Rate-limit sensitive and expensive routes before parsing, database, storage, or external work.

## Detailed References

- [Authentication, access, search safety, redaction](auth-and-access.md)
- [Data, uploads, cleanup, database performance](data-and-storage.md)
- [Client cache, identity transitions, notifications](client-data-flow.md)
- [Hosting, environment, CI and release](deployment-and-delivery.md)
- [HTTP contracts and rate limits](../engineering/api-governance.md)
- [Module structure and coding rules](../engineering/code-standards.md)
