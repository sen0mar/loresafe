# Feature History

Record one concise entry after a feature works end to end and the user asks to commit/merge into `main`.

## Completed Features

- Feature 1: Runnable app shell — Added the pnpm workspace, database-free Express health API with validated env and credentialed CORS, Vite React home route with live TanStack Query health status, and focused API tests.
- Feature 2: Frontend foundation — Added Tailwind CSS v4, ThreadSync semantic tokens, shadcn/ui basics, Sonner toast support, and a responsive app shell that keeps API health visible.
- Feature 3: Signup auth foundation — Added Prisma/PostgreSQL config with the initial users migration, Argon2id password hashing, HttpOnly JWT signup sessions, a demo user seed, and a real `/signup` form.
- Feature 4: Login/logout auth loop — Added login, logout, and current-user auth APIs with generic credential errors, safe profile responses, frontend auth hooks, a `/login` route, current-user header UI, and a smaller split app shell.
- Feature 5: Auth middleware and protected profile — Added reusable session-loading middleware with `requireUser`, protected current-user API handling, frontend protected/public-only route guards, and a `/app/profile` page for the authenticated user.
- Feature 6: Auth Upstash rate limits — Added Redis-backed auth rate limiting with Upstash REST credentials, strict signup/login/logout limits, consistent `429` errors, proxy-aware IP handling, and focused backend regression tests.

## Entry Format

- Feature N: Feature name — short summary of what changed, including important migrations, security changes, storage changes, or integration changes.
