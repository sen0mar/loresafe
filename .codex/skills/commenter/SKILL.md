---
name: commenter
description: Use after a ThreadSync feature or bug fix is implemented when the user asks to add comments, clarify code, or run commenter. Add only concise comments to changed non-obvious security, spoiler/progress, auth, async, query, or transaction logic; do not refactor, restyle, or comment obvious code.
---

# Commenter

Add sparse, high-value comments to the current ThreadSync change.

## Inputs

- The user's latest commenting request.
- The changed files or current session work. Prefer `git diff` when available.
- `context/features/current-feature.md` when it contains an active scope.
- The surrounding code, so each comment matches local style and intent.

## Output

- Comments only, except formatter changes caused by edited syntax.
- A short report of which files were commented and why.
- A clear note when no comments were worth adding.

## Rules

- Comment only code changed by the current feature or bug fix.
- Do not change runtime behavior, names, structure, imports, styling, or tests.
- Do not comment generated files, migrations, shadcn-generated components, config boilerplate, or obvious markup.
- Do not add file banners, section labels, TODO/FIXME notes, or broad explanations.
- Never include secrets, hashes, cookies, JWTs, reset links, private URLs, R2 credentials, or sensitive operational details.

## Comment When

- A policy branch prevents spoiler leaks, privilege escalation, or unsafe moderation access.
- A query filter intentionally removes locked, hidden, unsafe, or unauthorized content.
- A DTO transformation differs from the database model to preserve spoiler safety or privacy.
- A transaction, ordering step, retry behavior, or idempotency guard protects consistency.
- A rate limit, cookie, CORS, upload, auth, or notification decision has security impact.
- A TanStack Query invalidation, optimistic update, rollback, or async edge case is easy to break.

## Do Not Comment When

- Names and structure already explain the code.
- The comment would repeat a condition, assignment, or JSX element.
- The comment describes product requirements better suited for `context/`.
- The issue should be fixed in code instead of explained in a comment.

## Style

- Prefer one line; use two only when needed.
- Explain intent, risk, or invariant rather than mechanics.
- Place the comment next to the branch, query, transformation, or effect it clarifies.
- Use short JSDoc only for exported helpers whose contract or security constraint is not obvious from the signature.

## Workflow

1. Identify the current changed files and ignore unrelated code.
2. Read each candidate area and ask whether a future maintainer would reasonably wonder why it works that way.
3. Add the smallest useful comment only where the answer is yes.
4. Re-read each new comment and remove it if it does not prevent a realistic misunderstanding.
5. Run formatter or typecheck only when the edited syntax makes that useful.
6. Report the files touched and the kinds of logic clarified.
