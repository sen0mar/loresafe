---
name: cleanup
description: Audit the LoreSafe codebase for dead code, code-standards drift, refactor opportunities, test and docs hygiene, then apply only the items the user picks. Use when the user runs /cleanup, /cleanup report, or /cleanup apply "...", or asks for a cleanup audit or to apply cleanup report items.
argument-hint: '[report | apply "<item IDs or description>"]'
---

# LoreSafe Cleanup

Two modes. With no argument, run `report`.

- `/cleanup` or `/cleanup report` — audit the whole repository and write a
  report. **Changes no code.**
- `/cleanup apply "<selection>"` — apply only the selected items from the
  latest cleanup report.

This skill is the whole-repo audit of accumulated debt. It is not a review of
the current diff (that is `/simplify`) and not a security review (that is
`/security-check`).

## Rules for both modes

- **Never touch:** `apps/api/prisma/migrations/**`, `apps/api/src/generated/**`,
  `apps/api/openapi/openapi.json` (only through `pnpm api:contract:generate`),
  `.env*` files.
- **Security-sensitive areas are report-only.** Items in `*.policy.ts`,
  `apps/api/src/modules/auth/**`, `apps/api/src/modules/uploads/**`,
  `apps/api/src/core/security/**`, `apps/api/src/core/storage/**`,
  `apps/api/src/core/monitoring/telemetry-scrubbing.ts`, or any DTO that
  redacts spoiler content get the `security-sensitive` tag. `apply` refuses
  them and says to make the change deliberately and run `/security-check`.
- **Behavior-preserving only.** No API contract changes, no response shape
  changes, no schema or migration changes, no dependency upgrades. If
  `pnpm api:contract:check` would change, it is not a cleanup.
- Follow `context/engineering/code-standards.md`; it defines what "clean" means
  in this repo.
- Do not delete anything listed in `keep.md`.

---

## Mode: report

1. Record `HEAD` (short SHA and branch) and whether the tree is dirty.
2. Run the checks in `checks/` in this order: `dead-code.md`, `standards.md`,
   `structure.md`, `tests.md`, `docs.md`. Each file says what tools to run and
   what to look for.
3. **Verify every candidate** by opening the code. Tool output is a lead, not a
   finding. Drop false positives; if a false positive will recur, propose a
   `keep.md` entry in the report instead of listing it as an item.
4. Assign each item an ID, priority, effort, and risk (definitions below).
5. Write the report to `reports/YYYY-MM-DD-cleanup.md` (append `-2`, `-3` if
   the file exists).
6. Reply in chat with counts per priority and category, the top five items
   (one line each), and the report path. Do not paste the whole report.

### IDs

Prefix by category, numbered within the report: `D` dead code, `S` standards,
`R` refactor/structure, `T` tests, `C` docs/config. Example: `D3`, `R2`.

### Priority

- **P1 — Do soon:** dead code or drift that misleads readers or hides bugs
  (unused file that looks live, unlisted dependency, docs pointing at removed
  code, controller doing data access, `.only` left in a test, N+1 query).
- **P2 — Worth doing:** clear maintainability wins with low risk (unused
  exports/deps, functions over 60 lines, repeated test setup, broad Prisma
  `include`).
- **P3 — Nice to have:** cosmetic or large-but-optional (naming, splitting a
  big file with no active pain, old TODOs).

### Effort and risk

- Effort: `S` (minutes, one file), `M` (a few files), `L` (multi-file
  refactor; should be its own change).
- Risk: `low` (mechanical, covered by typecheck), `medium` (logic moves,
  covered by tests), `high` (touches transactions, caching, or weakly tested
  code). Tag `security-sensitive` where it applies.

### Report format

```markdown
# Cleanup report — <YYYY-MM-DD>

- Commit: <short SHA> (<branch>)<, dirty tree>
- Summary: <n> P1, <n> P2, <n> P3 · <n> dead code, <n> standards, <n> refactor, <n> tests, <n> docs/config

## P1 — Do soon

### Dead code

- **D1** · S · low — Remove unused file `apps/web/src/...`
  - Evidence: no imports (knip + grep), last touched <date>.
  - Change: delete the file and its test.

### Standards

...

## P2 — Worth doing

(same category subsections)

## P3 — Nice to have

(same category subsections)

## Report-only (security-sensitive)

Items found in security-sensitive areas, with the reason; not applicable via `apply`.

## Proposed keep.md entries

## Coverage

Tools run (with versions), checks skipped and why.
```

Omit empty priority or category subsections. Keep each item to its evidence
and the concrete change; no essays.

---

## Mode: apply

1. **Find the report.** Use the newest `reports/*-cleanup.md`. If none exists,
   stop and tell the user to run `/cleanup report` first.
2. **Resolve the selection.**
   - IDs (`"D1, D3, S2"`), ranges within a category (`"D1-D4"`), or a whole
     priority (`"P1"`) map directly to report items.
   - A free-text selection (`"split clubs.repository"`) must match exactly one
     report item. If it matches several, none, or describes work that is not
     in the report, list what you found and ask before changing anything.
   - Refuse `security-sensitive` items and say why.
3. **Check freshness.** If files an item touches changed since the report's
   commit, re-verify that item before applying; skip it if it no longer holds.
4. **Confirm the plan** in one short message: the items, files touched, and the
   check commands. Proceed when the selection was unambiguous IDs; ask first
   for any `L` effort or `high` risk item.
5. **Branch.** If on `main`, create `chore/cleanup-<YYYY-MM-DD>` first. Never
   commit, push, or open a PR unless the user asks.
6. **Apply in batches** of related items (one category or one module at a
   time). After each batch run:
   - `pnpm lint`
   - `pnpm typecheck`
   - Tests for the touched workspace: `pnpm --filter @loresafe/api test` and/or
     `pnpm --filter @loresafe/web test`
   - `pnpm api:contract:check` if anything under `apps/api/src` changed
   - `pnpm format:check`

   If a check fails and the fix is not obvious and local, revert that batch
   and mark its items `failed` with the error.

7. **Update the report.** Add a `## Applied <YYYY-MM-DD>` section listing each
   selected item as `applied`, `skipped` (with reason), or `failed` (with the
   check that failed).
8. **Reply** with what changed, check results, and anything skipped or failed.
