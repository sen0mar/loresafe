---
name: tester
description: Use after a ThreadSync feature or bug fix is implemented when the user asks to add, update, or run tests. Create the smallest meaningful tests for changed behavior only, prioritizing backend auth, spoiler/progress visibility, policies, validation, and user-visible frontend behavior; do not broaden scope or add placeholder tests.
---

# Tester

Add focused tests for the current ThreadSync change.

## Inputs

- The user's latest testing request.
- The changed files or current session work. Prefer `git diff` when available.
- `context/features/current-feature.md` when it contains an active scope.
- Existing package scripts, test helpers, factories, and setup files.

## Output

- Tests that prove the changed behavior.
- The narrowest useful test command results.
- Any real remaining coverage gap or blocker, stated plainly.

## Rules

- Test only the feature or bug fix just changed.
- Prefer a few behavior-focused tests over broad snapshots or render-only tests.
- Use existing tooling and local patterns before adding setup.
- Add the smallest conventional test setup only when the affected package has none.
- Do not refactor production code unless a tiny extraction is required for testability.
- Do not add tests for nearby but unrelated modules.

## Risk Priority

1. Backend authorization, ownership, membership, roles, bans, and invite checks.
2. Spoiler/progress visibility and response shaping before data leaves the API.
3. Zod validation, error paths, and rate-limited or expensive routes.
4. Successful user flows for the changed feature.
5. TanStack Query invalidation, optimistic updates, rollback, or cache behavior when the change uses them.

For any protected read that can expose story content, include a denied-path test proving unsafe text, images, comments, notifications, or metadata are not returned.

## Backend Approach

- Test policies, services, Zod schemas, and API routes at the lowest level that proves the behavior.
- Keep fixtures small: create only the users, clubs, memberships, milestones, progress, content, and reports needed.
- Assert DTO shape and omitted unsafe fields, not just status codes.
- Cover both allowed and denied cases when the change touches auth, roles, membership, bans, ownership, moderation, uploads, or progress.
- Keep Prisma access bounded and use existing database test lifecycle helpers when present.

## Frontend Approach

- Test visible states: loading, empty, error, denied, locked, unlocked, and success.
- Mock HTTP at the API boundary. Do not mock TanStack Query internals.
- Verify the shared API client request shape when forms, params, filters, or credentials matter.
- Avoid brittle assertions on class names, layout details, or shadcn internals.

## Workflow

1. Identify the smallest behavior list from the changed files, current feature scope, and user request.
2. Choose backend and frontend tests according to the risk priority above.
3. Add tests next to the code they verify unless the repo already has a clearer integration test location.
4. Run the narrowest relevant command first.
5. Fix failures only when they reveal a bug in the current change or in the new test.
6. Run package-level test or typecheck commands when practical.
7. Report what was covered, what command ran, and any meaningful gap.
