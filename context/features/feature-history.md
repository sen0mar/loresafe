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
- Feature 14: Milestone timeline — Added the club milestone model with a committed migration, demo timeline seed data, authenticated spoiler-safe milestone reads, real Timeline UI, and backend redaction tests for unsafe milestone names.
- Feature 15: Milestone creation — Added owner/moderator milestone creation with safe response redaction, next-position appends, a club settings builder panel, timeline cache refreshes, rate limiting, and focused backend authorization/order tests.
- Feature 16: Milestone template generation — Added empty-timeline template generation for books, shows, movies, games, podcast/courses, and custom timelines with transaction-safe bulk milestone creation, overwrite protection, frontend safe-name previews, and focused backend regression tests.
- Feature 17: Milestone editing and ordering — Added owner/moderator milestone text and spoiler-name updates, transaction-safe adjacent milestone moves with stable IDs, immediate timeline cache updates, and focused backend authorization/order regression tests.
- Feature 18: Club progress tracking — Added per-user club progress and history with a committed migration, authenticated member-only progress read/update APIs, a right-rail progress update UI, query invalidation, demo seeding, and focused backend regression tests.
- Feature 19: Reading mode and quick progress — Added member-only quick milestone advancement, centralized conservative spoiler/mode policy helpers, explicit finished-mode storage coverage, a right-rail next-milestone action, and focused backend regression tests.
- Feature 20: Spoiler-safe club feed — Added the Post model with a committed migration, demo visible and locked posts, authenticated spoiler-safe club feed reads with private-club protection, a Feed tab UI, and focused backend leak regression tests.
- Feature 21: Create club posts — Added a committed club-ban migration, authenticated member-only post creation with ban and milestone ownership checks, spoiler-safe create responses, a feed create-post dialog, and focused backend regression tests.
- Feature 22: Post detail route — Added authenticated `GET /api/posts/:postId` with feed sanitizer reuse, direct URL spoiler-lock protection, a protected `/app/posts/:postId` detail page, feed-card post links, and focused backend leak regression tests.
- Feature 23: Cursor-paginated feed tabs — Added cursor-paginated `safe`, `locked`, `all`, and `my-posts` club feed tabs with backend-owned filtering, supporting indexes, tab-scoped infinite queries, and focused backend pagination/sanitization tests.
- Feature 24: Comments foundation — Added the Comment model with a committed migration, authenticated comment list/create APIs, independent locked-comment sanitization, real post comment counts, post-detail comment UI, and focused backend authorization/leak regression tests.
- Feature 25: Comment replies and later locks — Added one-level comment replies, optional same-club later milestone requirements, backend progress enforcement/redaction tests, and post-detail reply controls with advanced milestone selection.
- Feature 26: Brave reveal for locked content — Added explicit one-time post/comment reveal endpoints for Brave mode, Finished-mode normal visibility, local-only reveal UI, and focused backend leak regression tests.
- Feature 27: Unanswered feed tab — Added an `unanswered` club feed filter backed by visible non-deleted comment counts, a frontend Unanswered tab with real empty states, and focused sanitizer/count regression tests.

## Entry Format

- Feature N: Feature name — short summary of what changed, including important migrations, security changes, storage changes, or integration changes.
