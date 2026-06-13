# Feature History

Record one concise entry after a feature works end to end and the user asks to commit/merge into `main`.

## Completed Features

- Feature 1: Runnable app shell — Added the pnpm workspace, database-free Express health API with validated env and credentialed CORS, Vite React home route with live TanStack Query health status, and focused API tests.
- Feature 2: Frontend foundation — Added Tailwind CSS v4, ThreadSync semantic tokens, shadcn/ui basics, Sonner toast support, and a responsive app shell that keeps API health visible.
- Feature 3: Signup auth foundation — Added Prisma/PostgreSQL config with the initial users migration, Argon2id password hashing, HttpOnly JWT signup sessions, a demo user seed, and a real `/signup` form.
- Feature 4: Login/logout auth loop — Added login, logout, and current-user auth APIs with generic credential errors, safe profile responses, frontend auth hooks, a `/login` route, current-user header UI, and a smaller split app shell.
- Feature 5: Auth middleware and protected profile — Added reusable session-loading middleware with `requireUser`, protected current-user API handling, frontend protected/public-only route guards, and a `/app/profile` page for the authenticated user.
- Feature 6: Auth Upstash rate limits — Added Redis-backed auth rate limiting with Upstash REST credentials, strict signup/login/logout limits, consistent `429` errors, proxy-aware IP handling, and focused backend regression tests.
- Feature 7: Profile settings slice — Added username and bio profile fields with committed migrations, authenticated profile updates with duplicate username validation, a profile update rate limit, `/app/settings/profile`, and focused backend regression tests.
- Feature 8: Authenticated home redirects — Updated automatic authenticated redirects so login, signup, public-only route guards, and `/app` fallbacks land on the protected home route while keeping profile settings directly accessible.
- Feature 9: Clubs discovery foundation — Added club and membership models with visibility/role enums, a committed clubs discovery migration, demo public club seeding, authenticated public-only `GET /api/clubs`, `/app/explore`, and focused discovery regression tests.
- Feature 10: Create club flow — Added optional club rules with a committed migration, authenticated `POST /api/clubs` transactional owner membership creation, member-aware club detail reads, duplicate slug handling, private discovery protection, `/app/clubs/new`, and post-create club redirects.
- Feature 11: Club detail route and page — Added nested membership and safe settings to authenticated club detail responses, private/invite-only non-member denial, `/app/clubs/:slug` header/tabs/status UI, and focused club detail authorization tests.
- Feature 12: Public club join and joined sidebar — Added authenticated public-club joins with idempotent membership creation, joined-club sidebar data, live sidebar refresh after joining, and focused backend authorization tests.
- Feature 13: Club invites — Added hashed-token invite storage with a committed migration, owner/moderator invite generation, authenticated invite acceptance with expired/revoked/maxed protections, safe invite redirect handling, and focused backend regression tests.

## Entry Format

- Feature N: Feature name — short summary of what changed, including important migrations, security changes, storage changes, or integration changes.
