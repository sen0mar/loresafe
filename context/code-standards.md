# Code Standards

## General

- Prefer obvious, boring code over clever abstractions.
- Keep files, functions, components, and services single-purpose.
- Split a function/component when it mixes validation, authorization, data access, formatting, and UI concerns.
- As a guideline, keep most functions under 40 lines and investigate anything over 60 lines.
- Use descriptive names. Avoid vague names like `data`, `item`, `handleStuff`, `utils`, and `manager` when a domain name exists.
- Do not duplicate security-sensitive logic; centralize it in policies/services.
- Do not add global abstractions before at least two real call sites need them.

## TypeScript

- Use strict TypeScript.
- Avoid `any`; use `unknown` at boundaries and validate/narrow it.
- Do not expose Prisma model types directly as API response contracts.
- Use DTO types for API responses and feature-local types for UI needs.
- Keep shared types small and stable; do not create dumping-ground `types.ts` files.
- Validate env vars at startup.

## Frontend

- Route/page components compose layouts and feature components; they should not contain large business logic.
- Put remote data hooks and query keys in `features/<feature>/api`.
- Use TanStack Query for fetches, mutations, loading states, errors, optimistic updates, and invalidation.
- Use TanStack Store only for small client state such as active panels, temporary global filters, or layout preferences.
- Keep form schemas near the feature that owns the form.
- Split UI into small components: shell/layout, cards, lists, forms, dialogs, empty states, and status badges.
- Prefer explicit props over hidden global state.
- Keep optimistic UI reversible and invalidate/refetch after important mutations.
- Use `credentials: "include"` through the shared API client.

## Styling

- Use semantic tokens from `ui-context.md`; do not hardcode hex colors or raw Tailwind palette colors in feature components.
- Use shadcn/ui as the component foundation and compose project-specific components around it.
- Do not edit generated shadcn components unless the task explicitly requires it.
- Keep class lists readable; extract repeated variants with small helpers only when it improves clarity.
- Every interactive element needs visible hover, disabled, loading, and focus states.
- Components must remain responsive; do not build desktop-only layouts.

## Backend

- Routes define paths and middleware only.
- Controllers parse/validate request data and return responses.
- Services own business rules and transactions.
- Repositories own Prisma queries and never receive `req`/`res` objects.
- Policies own authorization and resource-access decisions.
- Use one consistent error shape for API failures.
- Return generic auth errors such as `Invalid credentials`.
- Do not return raw internal errors, stack traces, secrets, hashes, internal tokens, or private URLs.
- Keep domain modules close together instead of using broad global controller/service folders.

## Data Access

- Use DTO-shaped Prisma `select` clauses.
- Avoid broad `include` unless the route truly needs the relation.
- Avoid N+1 queries; use bounded joins, batched queries, or explicit follow-up queries.
- Keep writes that must succeed together in transactions.
- Store flexible metadata in JSONB only when the shape is genuinely variable.
- Follow the migration rule in `AGENTS.md` for every schema change.

## File Organization

Recommended structure:

```txt
loresafe/
  apps/
    web/
      src/
        app/
        shared/
          api/
          components/
          hooks/
          lib/
        features/
          <feature>/
            api/
            components/
            hooks/
            pages/
            schemas/
            stores/
            types/

    api/
      src/
        config/
        core/
          errors/
          http/
          logging/
          security/
        modules/
          <module>/
            <module>.routes.ts
            <module>.controller.ts
            <module>.service.ts
            <module>.repository.ts
            <module>.schema.ts
            <module>.policy.ts
        jobs/
        events/
        prisma/

  context/
```

Rules:

- Shared code must be genuinely reusable across features.
- Avoid catch-all `utils` files for domain behavior.
- Generated files must live in clearly marked generated directories.
- Keep tests near the code they verify unless a separate integration test folder is clearer.

## Testing and Verification

- Unit test policies, services, schema validation, and pure helpers.
- Integration test auth, membership, progress updates, feed visibility, comments, reports, invites, uploads, and moderation actions.
- The most important tests prove that users cannot access content beyond their allowed progress.
- Test both allowed and denied paths for sensitive APIs.
- Include at least one regression test for each fixed spoiler leak or authorization bug.
- Prefer small focused tests over broad brittle snapshots.
