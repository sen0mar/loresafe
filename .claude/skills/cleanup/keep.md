# Keep list

Things that look unused or unclean but are intentional. The report skips
them; `apply` never removes them. Add an entry only when the user agrees;
include the date and reason.

- `apps/api/src/modules/debug/debug.routes.ts` — Sentry verification route,
  enabled only outside production/test by `SENTRY_ENABLE_DEBUG_ROUTE`.
- `apps/api/scripts/reset-development-database.ts`,
  `apps/api/scripts/wipe-development-database.ts`,
  `apps/api/scripts/perf-seed-check.ts`,
  `apps/api/scripts/verify-browser-test-account.ts` — manual or CI tools run
  through `package.json` scripts or workflows, not imports.
- `pnpm-workspace.yaml` `overrides` — security patches; report only as
  "may be removable", never remove in `apply`.
- `apps/web/src/shared/components/ui/**` — generated shadcn components; delete
  whole when unused, never restyle.
