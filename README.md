# LoreSafe

<p align="center">
  <img src="apps/web/public/logo-mark.png" alt="LoreSafe logo" width="88" />
</p>

<p align="center">
  <strong>Discuss every story without seeing what comes next.</strong>
</p>

<p align="center">
  <a href="https://www.loresafe.org">Live app</a> ·
  <a href="https://www.loresafe.org/clubs">Public clubs</a> ·
  <a href="apps/api/openapi/openapi.json">OpenAPI contract</a> ·
  <a href="context/project-overview.md">Product overview</a>
</p>

LoreSafe is a progress-aware social discussion platform for books, shows, anime, manga, films, games, podcasts, courses, and custom story timelines. Members join clubs, record where they are in a story, and receive a feed shaped to what they can safely know.

Unlike a conventional spoiler tag, LoreSafe treats spoiler protection as an authorization rule. Posts, comments, images, notifications, search results, and direct links are filtered by the API before content reaches the browser.

![LoreSafe spoiler-safe discussion interface](apps/web/public/og/loresafe-home.png)

## Why LoreSafe?

Most communities ask every author and reader to judge spoiler boundaries manually. That model breaks down when a group contains people at many different chapters, episodes, missions, or timestamps.

LoreSafe gives each club an ordered milestone timeline. Content declares the milestone required to view it, while every member keeps their own progress and reading mode. The backend compares those values on every protected read and returns either authorized content or a deliberately narrow locked placeholder.

## Features

- Public, private, and invite-only clubs with owner, moderator, and member roles.
- Custom milestone timelines and templates for books, shows, movies, games, podcasts, courses, and other media.
- Per-club progress history, quick advancement, explicit rewinds, and first-visit progress setup.
- Strict, Brave, and Finished reading modes.
- Personalized Safe, Locked, All, My Posts, and Unanswered feeds.
- Discussions, questions, theories, predictions, polls, reactions, reviews, images, quotes, and milestone updates.
- Nested comments, emoji reactions, spoiler-aware media, and recently unlocked discussions.
- Spoiler-safe durable notifications with refresh-on-focus delivery.
- Club and discussion search that preserves membership, ban, and progress rules.
- Reporting, moderator queues, spoiler-level correction, hiding, deletion, warnings, bans, and audit history.
- Public club pages, sitemap generation, crawler metadata, PWA assets, and route-level SEO controls.
- Responsive dark UI with keyboard states, reduced-motion support, and accessibility regression coverage.

### Reading modes

| Mode         | Behavior                                                                              |
| ------------ | ------------------------------------------------------------------------------------- |
| **Strict**   | Only content at or behind the member's saved progress is visible.                     |
| **Brave**    | Future content stays locked, but the member may explicitly reveal an individual item. |
| **Finished** | The complete club timeline and its discussions are available.                         |

The server remains the authority in every mode. A hidden React component is never treated as a security boundary.

## Architecture

```mermaid
flowchart LR
    Browser["React + Vite client"] -->|"same-origin /api"| API["Express API"]
    API -->|"Prisma queries and transactions"| PostgreSQL[(PostgreSQL)]
    API -->|"presigned uploads and authorized reads"| R2["Cloudflare R2"]
    API -->|"rate-limit counters"| Redis["Upstash Redis"]
    API -->|"errors and traces"| Sentry["Sentry"]
    Browser -->|"focus and notification-open refresh"| API
```

The frontend owns presentation, optimistic interactions, and small UI state. The API owns validation, authentication, authorization, club policies, progress checks, response shaping, and storage access. PostgreSQL is the source of truth for membership, roles, bans, progress, visibility, audit records, file metadata, durable notifications, and storage-deletion records.

Browser requests use same-origin `/api` paths. Vite proxies them to the local API during development; Vercel rewrites them to the Render service in production.

### Technology

| Layer                  | Main technologies                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| Web                    | React 19, TypeScript, React Router, Vite, Tailwind CSS, Radix/shadcn-style primitives         |
| Data and forms         | TanStack Query, Zod, native React forms                                                       |
| API                    | Node.js 22, Express 5, TypeScript, Zod                                                        |
| Auth                   | Argon2id, short-lived JWT access sessions, rotating opaque refresh sessions, HttpOnly cookies |
| Database               | PostgreSQL, Prisma ORM, PostgreSQL full-text search                                           |
| Deferred work          | Atomic request transactions and bounded request-driven storage cleanup                        |
| Storage and limits     | Cloudflare R2, Upstash Redis                                                                  |
| Quality and operations | Vitest, Testing Library, Playwright, axe, ESLint, Prettier, Sentry                            |
| Hosting                | Vercel for the web app, Render for the long-running API                                       |

### Repository layout

```text
loresafe/
├── apps/
│   ├── api/                 # Express API, Prisma schema/migrations, jobs, tests
│   │   ├── openapi/         # Generated OpenAPI 3.1 contract
│   │   ├── prisma/          # Schema, committed migrations, guarded demo seed
│   │   └── src/             # Config, core infrastructure, and domain modules
│   └── web/                 # React application, public assets, and UI tests
│       └── src/             # App composition, feature modules, shared UI/API code
├── context/                 # Product, architecture, UI, standards, and runbooks
├── e2e/                     # Browser security and accessibility checks
├── infra/                   # Monitoring, operations, and Cloudflare configuration
├── scripts/                 # Workspace-wide verification scripts
├── render.yaml              # Render API infrastructure definition
└── pnpm-workspace.yaml      # pnpm monorepo workspace
```

Backend modules follow `routes → controllers → services → repositories → policies`. Frontend pages remain composition layers, with remote state and UI behavior organized by feature.

## Getting started

### Prerequisites

- Node.js `22.17.1` (the exact version is recorded in `.node-version`)
- pnpm `11.5.3` through Corepack
- PostgreSQL with a database you can migrate
- Optional for full local integration: Upstash Redis, Cloudflare R2, and Sentry credentials

### 1. Install dependencies

```bash
corepack enable
pnpm install --frozen-lockfile
```

### 2. Configure the environment

Copy the development template from the repository root:

```bash
cp .env.example .env
```

At minimum, configure a PostgreSQL connection, a direct Prisma connection, and a JWT secret:

```dotenv
NODE_ENV=development
PORT=3000
CLIENT_ORIGIN=http://localhost:5173

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/loresafe
DIRECT_URL=postgresql://postgres:postgres@localhost:5432/loresafe

JWT_SECRET=replace-with-at-least-32-random-characters
SESSION_COOKIE_NAME=loresafe_session
SESSION_COOKIE_SECURE=false
```

`DATABASE_URL` may use a pooler at runtime. `DIRECT_URL` must use a direct/session PostgreSQL endpoint because Prisma migrations cannot run through a transaction pooler.

Generate a suitable local secret with, for example, `openssl rand -hex 32`. Do not commit `.env` files.

### 3. Apply the database migrations

```bash
pnpm --filter @loresafe/api prisma:migrate:deploy
```

LoreSafe uses committed migrations. Do not use `prisma db push`.

### 4. Start the app

```bash
pnpm dev
```

The web app runs at [http://localhost:5173](http://localhost:5173), and the API runs at [http://localhost:3000](http://localhost:3000). Vite forwards `/api` and `/sitemap.xml` requests to the API.

To run one side independently:

```bash
pnpm dev:web
pnpm dev:api
```

### Optional demo data

The seed is deliberately guarded so it cannot silently write to the wrong database. Add these values to `.env`, making `DEMO_SEED_DATABASE_URL` exactly equal to `DATABASE_URL`:

```dotenv
DEMO_SEED_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/loresafe
DEMO_SEED_CONFIRM=I_UNDERSTAND_THIS_WRITES_DEMO_DATA
DEMO_USER_EMAIL=demo@example.com
DEMO_USER_DISPLAY_NAME=Demo Reader
DEMO_USER_PASSWORD=replace-with-a-password-of-at-least-12-characters
```

Then run:

```bash
pnpm --filter @loresafe/api prisma:seed
```

The seed creates a demo reader, a public book club, milestones, progress, and representative safe and locked discussions. It is forbidden when `NODE_ENV=production`.

### Empty the Neon development database

The wipe-only command truncates every public application table, preserves
`_prisma_migrations`, and does not run a seed. It requires the configured pooled
`DATABASE_URL` and direct `DIRECT_URL` to identify the same Neon endpoint,
database, and username.

Copy the endpoint ID from the development Neon hostname (for example,
`ep-example-development-123456`) and add both wipe guards to `.env`:

```dotenv
DEV_DATABASE_WIPE_NEON_ENDPOINT_ID=ep-example-development-123456
DEV_DATABASE_WIPE_CONFIRM=I_UNDERSTAND_THIS_PERMANENTLY_DELETES_DEVELOPMENT_DATA
```

Then run the destructive command from the repository root:

```bash
pnpm db:wipe:development
```

The command is forbidden outside `NODE_ENV=development`, rejects non-Neon and
pooled destructive connections, and leaves external R2 objects unchanged.

### One-time recruiter showcase data

The showcase seed is separate from the normal development seed. It accepts an
explicitly approved Neon development or production endpoint, refuses any database
that already contains application data, and writes the complete dataset in one
serializable transaction.

Configure the matching endpoint ID, recruiter login, shared showcase password,
and exact confirmation:

```dotenv
SHOWCASE_SEED_NEON_ENDPOINT_ID=ep-example-showcase-123456
SHOWCASE_SEED_CONFIRM=I_UNDERSTAND_THIS_WRITES_SHOWCASE_DATA_TO_AN_EMPTY_DATABASE
SHOWCASE_RECRUITER_EMAIL=recruiter.demo@loresafe.org
SHOWCASE_USER_PASSWORD=replace-with-a-password-of-at-least-12-characters
```

Run the command once from the repository root:

```bash
pnpm db:seed:showcase
```

The seed creates two public clubs (Harry Potter and Game of Thrones), one private
Star Wars club, and one invite-only Lord of the Rings club. Its nine natural-name
personas cover owner, moderator, regular member, behind/ahead progress, Strict,
Brave, Finished, banned, and outsider behavior. All personas use the configured
shared password:

| Persona      | Login email                      | Main showcase state                                 |
| ------------ | -------------------------------- | --------------------------------------------------- |
| Maya Chen    | `SHOWCASE_RECRUITER_EMAIL`       | Recruiter login; owner, moderator, and mid-progress |
| Theo Bennett | `theo.bennett@demo.loresafe.org` | Owner and moderator; Finished/Brave progress        |
| Nadia Flores | `nadia.flores@demo.loresafe.org` | Behind-progress Strict member                       |
| Liam Carter  | `liam.carter@demo.loresafe.org`  | Ahead/Finished member and club owner                |
| Priya Shah   | `priya.shah@demo.loresafe.org`   | Strict member with future content locked            |
| Owen Brooks  | `owen.brooks@demo.loresafe.org`  | Brave-mode member                                   |
| Elena Rossi  | `elena.rossi@demo.loresafe.org`  | Finished member and private-club owner              |
| Jordan Blake | `jordan.blake@demo.loresafe.org` | Banned from the Harry Potter club                   |
| Samira Khan  | `samira.khan@demo.loresafe.org`  | Outsider who can use the seeded invite              |

The command prints the 43-character Lord of the Rings invite token after a
successful run. It creates no `FileAsset` rows and does not upload or delete R2
objects. Do not rerun it or point it at a database containing real users.

## Environment variables

The API validates its environment with Zod at startup and exits on invalid production configuration. See `.env.example` for development and `.env.production.example` for deployment.

| Group      | Variables                                                                                                              | Purpose                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| App        | `APP_NAME`, `NODE_ENV`, `PORT`, `CLIENT_ORIGIN(S)`, `PUBLIC_SITE_ORIGIN`                                               | Runtime mode, ports, browser origins, and canonical URLs                |
| Proxy      | `TRUST_PROXY_CIDRS`                                                                                                    | Explicit trusted proxy addresses/subnets for correct client IP handling |
| Database   | `DATABASE_URL`, `DIRECT_URL`                                                                                           | Pooled runtime traffic and direct migrations                            |
| Sessions   | `JWT_SECRET`, `JWT_PREVIOUS_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `SESSION_*`                                         | Access signing, key rotation, cookie behavior, and lifetimes            |
| Redis      | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`                                                                   | Distributed rate-limit counters                                         |
| R2         | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_BASE_URL`, `R2_*_TIMEOUT_MS` | Public and protected image storage                                      |
| Operations | `SERVER_*_TIMEOUT_MS`, `OPERATIONS_BEARER_TOKEN`                                                                       | HTTP budgets and protected metrics access                               |
| Monitoring | `SENTRY_*`, `VITE_SENTRY_*`                                                                                            | Server and browser error reporting/tracing                              |
| Data tools | `DEMO_SEED_*`, `DEMO_USER_*`, `DEV_DATABASE_RESET_DATABASE_URL`, `DEV_DATABASE_WIPE_*`, `SHOWCASE_*`                   | Explicitly authorized seed/reset/wipe operations                        |

Production additionally requires Redis, R2, Sentry, a metrics token, secure cookies, explicit client origins, and explicit trusted proxy ranges.

## Common commands

Run commands from the repository root.

| Command                           | Description                                             |
| --------------------------------- | ------------------------------------------------------- |
| `pnpm dev`                        | Start the web and API development servers in parallel   |
| `pnpm build`                      | Generate Prisma Client, type-check, and build both apps |
| `pnpm typecheck`                  | Type-check every workspace package                      |
| `pnpm lint`                       | Run ESLint with zero warnings allowed                   |
| `pnpm format:check`               | Verify formatting without changing files                |
| `pnpm test`                       | Run API and web unit/route tests                        |
| `pnpm test:coverage`              | Run configured API and web coverage gates               |
| `pnpm test:browser`               | Run Playwright browser security/accessibility tests     |
| `pnpm test:integration:database`  | Run the real-PostgreSQL integration suite               |
| `pnpm db:check`                   | Check migration status and regenerate Prisma Client     |
| `pnpm db:seed:showcase`           | Seed an approved empty Neon database with showcase data |
| `pnpm db:wipe:development`        | Empty the explicitly approved Neon development database |
| `pnpm api:contract:check`         | Verify the checked-in OpenAPI artifact is current       |
| `pnpm production:readiness:check` | Validate versioned operational-readiness evidence       |

`pnpm db:reset:development` is destructive and guarded. Use it only for an explicitly configured development database; never use it against shared or production data.

## API and data model

The API is REST JSON under `/api`, with SSE at `/api/events`. Major route groups cover authentication, users, clubs, invites, milestones, progress, posts, comments, reactions, notifications, reports, moderation, uploads, search, dashboards, public clubs, and operational health.

- The versioned OpenAPI 3.1 artifact is in [`apps/api/openapi/openapi.json`](apps/api/openapi/openapi.json).
- Liveness is available at `GET /api/health`.
- Dependency readiness is available at `GET /api/health/ready`.
- Operational metrics are available at `GET /api/health/metrics` only with the dedicated bearer token.

The normalized Prisma model includes users and revocable sessions; clubs, memberships, bans, and invites; milestones and progress history; posts, comments, reactions, and predictions; notifications, reports, and immutable audit attribution; plus file assets and durable storage-deletion records.

Growing feeds and lists use bounded keyset cursors. API responses use narrow DTOs rather than raw Prisma models.

## Security model

Spoiler safety and conventional application security share the same boundary: the API.

- Authorization loads current membership, role, ban, and progress data from PostgreSQL; JWT claims are not trusted for club permissions.
- Access JWTs and rotating refresh sessions live only in scoped HttpOnly cookies, with persisted hashed identifiers for revocation.
- State-changing cookie-authenticated requests are protected by SameSite cookies and trusted-origin checks.
- Locked posts and comments return safe metadata only. Spoiler text and protected media URLs are never included in unauthorized responses.
- Private media is accessed through backend-authorized, short-lived R2 flows; object keys are not authorization credentials.
- Request bodies, params, query strings, environment values, and webhook-like boundaries are validated with Zod.
- Sensitive and expensive endpoints are rate-limited before costly work.
- Moderation and security-sensitive actions are transactional and audited.
- Logs and error responses exclude passwords, hashes, cookies, tokens, secrets, private URLs, and stack traces.
- Security headers, noindex controls, request IDs, bounded timeouts, readiness checks, and release-gate tests are checked into the repository.

When changing visibility behavior, test both allowed and denied paths. The highest-priority regression is always proving that a user behind a milestone cannot retrieve future content through feeds, direct routes, comments, search, notifications, uploads, or moderation surfaces.

## Testing and release quality

The project uses focused Vitest tests beside the code they verify, real PostgreSQL integration tests for database and concurrency invariants, and Playwright for deployed-browser security and accessibility behavior.

The release gate in `.github/workflows/release-gate.yml` performs a frozen install, production dependency audit, migration and drift checks, linting, formatting, type-checking, unit and route tests, real-database tests, production builds, browser checks, and a full-history secret scan.

The usual local verification baseline is:

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm api:contract:check
```

Database integration and browser checks require their corresponding local or deployed test configuration.

## Deployment

The production topology is intentionally split:

- **Web:** Vercel serves the static Vite app at [www.loresafe.org](https://www.loresafe.org), applies browser security/noindex headers, and proxies `/api` to the backend.
- **API:** Render runs the long-lived Express process at `api.loresafe.org` without database-polling workers or startup database connections.
- **Database:** Managed PostgreSQL supplies pooled application traffic plus a direct endpoint for migrations and can suspend during idle periods.
- **Storage and limits:** Cloudflare R2 stores files; Upstash Redis stores distributed rate-limit counters.
- **Observability:** Sentry, protected application metrics, database-free liveness probes, manual deep readiness, alert definitions, and synthetic checks cover production operations.

`render.yaml` is the source of truth for API deployment. Migrations run in Render's pre-deploy phase, never in the web start command, so the service can bind its port immediately. Vercel behavior lives in `apps/web/vercel.json`, and the production R2 CORS policy is in `infra/cloudflare/r2-cors-production.json`.

See [`context/operations-runbook.md`](context/operations-runbook.md) for readiness, backup, restore, incident, rollback, and recovery procedures.

## Project documentation

| Document                                                                     | Contents                                                                 |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [`context/project-overview.md`](context/project-overview.md)                 | Product problem, users, scope, flows, and success criteria               |
| [`context/architecture-context.md`](context/architecture-context.md)         | System boundaries, data flow, auth, storage, performance, and invariants |
| [`context/ui-context.md`](context/ui-context.md)                             | Visual language, semantic tokens, layout, motion, and accessibility      |
| [`context/code-standards.md`](context/code-standards.md)                     | TypeScript, frontend, backend, data-access, and testing conventions      |
| [`context/api-governance.md`](context/api-governance.md)                     | API compatibility, errors, pagination, retries, and idempotency          |
| [`context/operations-runbook.md`](context/operations-runbook.md)             | Production operations and recovery                                       |
| [`context/features/feature-history.md`](context/features/feature-history.md) | Concise history of completed product increments                          |

## License

This repository does not currently include an open-source license. Unless a license is added, the source is not granted for redistribution or reuse.
