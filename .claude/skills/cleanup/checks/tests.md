# Test hygiene

Scope: `apps/api/src/**/*.test.ts`, `apps/api/scripts/*.test.ts`,
`apps/web/src/**/*.test.{ts,tsx}`, `e2e/**/*.ts`.

## Must-fix

- `.only(` on `it`, `test`, `describe` — P1.
- `.skip(`, `it.todo`, `xit`, `xdescribe` without a comment explaining why —
  P2.
- Commented-out tests — P2.

## Reliability

- Fixed sleeps (`setTimeout` in tests, `waitForTimeout`, `sleep(`) instead of
  awaiting a condition — P2.
- Tests that depend on run order or shared mutable state between cases — P2.
- Real network or time without fakes in unit tests — P2.

## Size and setup

- Test files over 1,500 lines (for example `features/regression-smoke.test.tsx`,
  `modules/posts/posts.routes.test.ts`, `modules/clubs/clubs.routes.test.ts`):
  look for repeated arrange blocks (same user/club/membership/progress setup)
  that could become shared builders or fixtures. Report the concrete builder
  to extract and where, as one item per file. Effort `M`/`L`, P2.
- Do not propose splitting a test file purely by size; propose it only along
  clear feature lines.

## Coverage gaps (report only)

- Modules with a `*.service.ts` or `*.repository.ts` and no test file — P3.
- Do not write new tests in `apply` unless the selected item explicitly says
  so.
