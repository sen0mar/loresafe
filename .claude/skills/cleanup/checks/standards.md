# Code-standards conformance

Source of truth: `context/engineering/code-standards.md`. Report deviations;
do not invent new rules.

## Backend layering (`apps/api/src/modules/*`)

- **Routes** (`*.routes.ts`) define paths and middleware only — no logic,
  validation, or Prisma.
- **Controllers** parse/validate with Zod and return responses — no Prisma, no
  business rules beyond calling the service. Prisma in a controller is P1.
- **Services** own business rules and transactions.
- **Repositories** own Prisma queries and never receive `req`/`res`.
- **Policies** own authorization (findings here are `security-sensitive`).
- Modules that import a concrete repository where ESLint's
  `no-restricted-imports` boundary would apply if the rule covered them are P3
  candidates for the command/query repository split already used by clubs,
  reports, and progress.

## Data access

- Broad Prisma `include` where a DTO-shaped `select` would do — P2.
- N+1 patterns: a Prisma call inside `for`/`map`/`forEach` or inside
  `Promise.all(items.map(...))` over unbounded input — P1.
- Unbounded `findMany` without `take` on growing tables — P1.
- Writes that must succeed together but are not in one transaction — P1
  (verify carefully; tag `high` risk).

## TypeScript

- `any` (explicit, `as any`, `<any>`), outside `src/generated` and tests — P2.
- Non-null assertions (`!`) on values from requests, database, or env — P2.
- Prisma model types used as API response types instead of DTOs — P1.
- Catch-all `types.ts` files that mix unrelated domains — P3.

## Functions and naming

- Functions over 60 lines (excluding tests and generated code) — P2; 40–60 is
  P3 only if it mixes validation, authorization, data access, and formatting.
  Measure with the TypeScript AST if practical, otherwise by reading.
- Vague names when a domain name exists: `data`, `item`, `handleStuff`,
  `utils`, `manager`, `helper`, `misc` — P3. Only report exported or
  widely-used names.
- Prefer `const` arrow functions for components, helpers, and callbacks —
  report only clusters, not one-offs (P3).

## Frontend (`apps/web/src`)

- Remote data hooks and query keys outside `features/<feature>/api` — P2.
- Page/route components containing business logic or direct `fetch` calls
  instead of composing feature components — P2.
- `fetch` calls not going through the shared API client (missing
  `credentials: "include"`) — P1.
- Edited generated shadcn components under `shared/components/ui` — P3 note
  only; never "fix" them back without the user's say.
- Repeated long Tailwind class lists (same 6+ classes in 3+ places) — P3.
