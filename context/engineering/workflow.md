# AI Workflow Rules

## Development Approach

Read this file before implementation and the active feature plan when doing feature work. Load only task-relevant references from `AGENTS.md` or [the context index](../README.md); do not read all context or feature history by default.

Context defines product, architecture, UI, and active scope; do not invent undocumented major behavior.

## Feature Branch Workflow

- Before starting a new feature, create a feature branch from `main` unless the user says not to.
- Before implementation, fill `context/features/current-feature.md` with the agreed scope and ask whether to begin.
- After the feature works and the user asks to commit/merge, reset [the current feature](../features/current-feature.md) and add one concise entry to [feature history](../features/feature-history.md).

## Commit Format

Use a short title and concise description of the change. Omit routine feature-plan/history maintenance from commit messages.

## Scoping Rules

- Work in small, verifiable feature units; split unrelated subsystem changes.
- Keep MVP behavior simple unless a small foundation clearly prevents rework.
- Do not add third-party services, stack changes, or advanced features without approval.

Example: implement a spoiler-safe feed endpoint and its UI as one unit; split unrelated uploads, moderation, and live rooms into separate work.

## Handling Missing Requirements

- Record unclear requirements in [the current feature](../features/current-feature.md) before implementing.
- When progress must continue, choose the simplest reversible behavior and record the assumption.
- Do not invent billing, public demos, email flows, integrations, AI moderation, or advanced analytics.
- Clarify before changing spoiler rules, role permissions, upload visibility, notification wording, or destructive moderation behavior.

## Documentation Updates

Use [the context index](../README.md) to find the document that owns a decision. Update that document and link to it elsewhere. Keep active state in [the current feature](../features/current-feature.md), merged summaries in [feature history](../features/feature-history.md), and omit implementation logs.

## Before Moving On

Verify that:

1. The current feature works end to end within scope.
2. Denied authorization/progress paths were tested.
3. List endpoints are bounded.
4. API responses are narrow and spoiler-safe.
5. No sensitive data is logged.
6. Required docs were updated.

## Dependency Installs

- Install from the package directory that owns the lockfile. Dependency downloads require network access; use the available permission mechanism when required by the execution environment.
- If an install produces no output for about five seconds, stop the stale process and resolve network/permission access before retrying. Never leave background installs running.
