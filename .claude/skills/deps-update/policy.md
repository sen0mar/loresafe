# Merge policy

A PR is **Eligible** only if every applicable rule below passes. When in
doubt, route it to **Needs you**; a skipped update costs a week, a broken
deploy costs users.

## Version

- Patch and minor updates only. Major updates → Needs you.
- For `0.x` packages, a minor bump (`0.35 → 0.36`) counts as major.
- Exact-pinned dependencies (no `^`/`~` in `package.json`, for example
  `sharp`) → Needs you; the pin is deliberate.
- `@types/node`: the major version must equal the Node major in
  `.node-version` (currently 22). Any other major → Blocked with the reason.
- Multi-package (grouped) PRs: every package must pass on its own.

## Critical packages (always Needs you, even for patches)

These enforce auth, authorization, rate limits, data access, uploads, or
input validation:

- `express`, `cookie-parser`, `cors`, `express-rate-limit`,
  `rate-limit-redis`, `@upstash/redis`
- `jose`, `@node-rs/argon2`
- `prisma`, `@prisma/client`, `@prisma/adapter-pg`, `pg`
- `zod`
- `sharp`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`
- Any package named in a `pnpm-workspace.yaml` `overrides` entry (the override
  may need to change with it).

For these, the report's upgrade plan names the files that use the package and
the tests that cover them.

## Extra verification

- `@sentry/node`, `@sentry/react`: eligible only if the telemetry scrubbing
  tests ran and passed in local verification
  (`apps/api/src/core/monitoring/telemetry-scrubbing.test.ts`). SDK upgrades
  must preserve the outbound-envelope redaction regressions
  (`context/architecture/auth-and-access.md`, Diagnostic Redaction).
- `react`, `react-dom`, `react-router-dom`, `@tanstack/react-query`: minor
  updates are eligible only if the PR's `Browser and accessibility` CI job is
  green.

## Release age

- The target version must have been published at least 7 days ago
  (`npm view <package> time --json`; for Actions, the release date via
  `gh api repos/<owner>/<repo>/releases/tags/<tag>`). Too new → Blocked
  ("retry next run").

## Changelog

- Read the release notes between the two versions (Dependabot's PR body,
  else the package's GitHub releases or CHANGELOG).
- Any mention of breaking changes, removed or renamed APIs, changed defaults,
  new minimum Node version, or security-relevant behavior changes → grep the
  repo for usage of the affected API. If LoreSafe uses it → Needs you.
- Deprecation warnings for APIs LoreSafe uses → still Eligible, but list them
  in the report.

## CI

- Every check on the PR's current head must be `SUCCESS`, `SKIPPED`, or
  `NEUTRAL`, and `Release gate` plus `Analyze JavaScript and TypeScript` must
  be `SUCCESS`. Any failure, cancellation, or pending check → Blocked.

## Lockfile and install safety (npm PRs)

- `git diff origin/main...FETCH_HEAD -- pnpm-lock.yaml` changes only the
  updated package(s) and their own transitive dependencies. Unrelated
  packages changing → Needs you.
- No new package with an install script (`preinstall`, `install`,
  `postinstall`) that is not already listed in `pnpm-workspace.yaml`
  `allowBuilds`.
- Overrides in `pnpm-workspace.yaml` still resolve (confirm with
  `pnpm why <override package>` in the worktree for any override touched).

## GitHub Actions PRs

- Every changed `uses:` is a full 40-character commit SHA with the reviewed
  release tag in an adjacent comment (`# vX.Y.Z`), per
  `context/architecture/deployment-and-delivery.md`. Missing SHA or comment →
  Blocked.
- The SHA must be the commit the tag points to:
  `gh api repos/<owner>/<repo>/git/ref/tags/<tag>`; if the object is a `tag`,
  dereference it with `gh api repos/<owner>/<repo>/git/tags/<sha>`. Mismatch →
  Blocked (possible tampering).
- Both `codeql-action/init` and `codeql-action/analyze` PRs must move to the
  same version; if only one is eligible, hold both.
