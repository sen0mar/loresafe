# AI Workflow Rules

## Development Approach

Build ThreadSync incrementally. Context files define the product, architecture, UI direction, and current feature scope. Do not infer major behavior that is not documented.

## Feature Branch Workflow

- Before starting a new feature, create a feature branch from `main` unless the user says not to.
- Before implementation, fill `context/features/current-feature.md` with the agreed scope and ask whether to begin.
- After the feature works and the user asks to commit/merge, reset `current-feature.md` and add one concise entry to `feature-history.md`.

## Scoping Rules

- Work on one feature unit or subsystem at a time.
- Prefer small, verifiable increments.
- Split work when it mixes unrelated frontend, backend, database, upload, auth, or moderation concerns.
- Keep MVP behavior simple unless a small foundation clearly prevents rework.
- Do not add third-party services, stack changes, or advanced features without approval.

Good feature units:

- Auth signup/login/logout with cookie session.
- Club creation and membership join flow.
- Milestone builder for one club.
- Manual progress update and progress history.
- Spoiler-safe feed read endpoint and UI.
- Create post with required milestone.
- Comment creation and visibility checks.
- Report queue with moderator resolution.
- R2 upload intent and confirmation flow.
- SSE notifications foundation.

Overly broad feature units:

- “Build the whole app.”
- “Implement clubs, posts, comments, notifications, and moderation together.”
- “Add uploads plus full feed plus live rooms.”
- “Redesign the UI while changing auth and database schema.”

## Handling Missing Requirements

- Add unclear questions to `current-feature.md` before implementing.
- When progress must continue, choose the simplest reversible behavior and record the assumption.
- Do not invent billing, public demos, email flows, integrations, AI moderation, or advanced analytics.
- Clarify before changing spoiler rules, role permissions, upload visibility, notification wording, or destructive moderation behavior.

## Documentation Updates

Update only the file that owns the decision:

- Product scope or MVP behavior → `project-overview.md`.
- Stack, data flow, auth, storage, deployment, invariants → `architecture-context.md`.
- Folder structure or code conventions → `code-standards.md`.
- Colors, tokens, layout, visual direction → `ui-context.md`.
- Active implementation state → `features/current-feature.md`.
- Finished merged features → `features/feature-history.md`.

Keep documentation concise. Do not store long implementation logs.

## Before Moving On

Verify that:

1. The current feature works end to end within scope.
2. Denied authorization/progress paths were tested.
3. List endpoints are bounded.
4. API responses are narrow and spoiler-safe.
5. No sensitive data is logged.
6. Required docs were updated.
