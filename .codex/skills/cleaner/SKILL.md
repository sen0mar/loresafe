---
name: cleaner
description: Use when the user directs Codex to clean up specific ThreadSync code, especially long functions, large files, tangled components, or duplicated logic. Perform precise, surgical refactors that preserve behavior, extract reusable logic only where justified, and organize code according to the existing frontend and backend app architecture.
---

# Cleaner

Refactor user-directed ThreadSync code into smaller, clearer pieces without changing behavior.

## Inputs

- The exact files, functions, modules, or feature area the user asks to clean up.
- The surrounding call sites needed to preserve behavior.
- `context/architecture-context.md` and `context/code-standards.md` for module boundaries and folder rules.
- Existing tests, type checks, and package scripts for verification.

## Output

- A focused refactor of the requested code only.
- New files or folders only when they make the targeted code easier to maintain.
- Verification results, or the exact reason verification could not run.
- A short summary of what was extracted, moved, or simplified.

## Rules

- Stay inside the user-directed scope. Inspect adjacent call sites only to keep the refactor safe.
- Preserve runtime behavior, API contracts, auth rules, spoiler/progress visibility, and UI behavior.
- Prefer small extractions over broad rewrites.
- Do not introduce new services, libraries, architecture layers, or app-wide conventions.
- Do not move security-sensitive backend logic into frontend code or client-only guards.
- Do not create catch-all `utils`, `helpers`, `types`, or `components` dumping grounds.
- Do not rename public routes, DTO fields, query keys, exported APIs, or Prisma fields unless the user explicitly requests it.
- Keep comments sparse; add them only when the extracted logic has a non-obvious invariant.

## Refactor Targets

Look for high-value cleanup opportunities:

- Functions mixing validation, authorization, data access, formatting, and response shaping.
- React pages or components that combine layout, server state, form state, and domain formatting.
- Repeated logic that has at least two real call sites after the refactor.
- Large files where splitting by responsibility improves navigation.
- Inline transformations that deserve a named mapper, schema, hook, component, policy, or service helper.
- Complex conditionals where a well-named predicate reduces future mistakes.

Skip changes that are merely aesthetic, speculative, or unrelated to the user's requested area.

## Architecture Placement

Follow the existing app architecture:

- Frontend API wrappers, query keys, and server-state hooks belong in `apps/web/src/features/<feature>/api`.
- Frontend feature components belong in `apps/web/src/features/<feature>/components`.
- Frontend pages compose feature components and should not hold large business logic.
- Frontend schemas, hooks, stores, and types stay feature-local unless genuinely shared.
- Shared frontend code goes under `apps/web/src/shared` only when multiple features already need it.
- Backend routes stay thin and delegate to controllers.
- Backend controllers validate input and return DTOs.
- Backend services own business rules and transactions.
- Backend repositories own Prisma access.
- Backend policies own authorization and resource-access decisions.
- Backend module files stay under `apps/api/src/modules/<module>`.

## Workflow

1. Read the user-directed code and nearby call sites before editing.
2. Identify the smallest behavior-preserving cleanup plan.
3. Choose extraction names and file locations that match the existing feature/module structure.
4. Move or extract one responsibility at a time.
5. Update imports and exports without changing public contracts.
6. Run the narrowest relevant test, typecheck, lint, or build command.
7. Fix refactor-caused failures, then stop when the targeted cleanup is complete.

## Quality Bar

- Most functions should be comfortably readable; investigate anything over 60 lines.
- Extracted logic should have a clear domain name and one reason to exist.
- Reusable code should be reused immediately or remain local.
- Types should become narrower and clearer, not more generic.
- The final diff should make the requested code easier to follow without expanding the blast radius.
