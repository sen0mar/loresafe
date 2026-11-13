# Dead code

Unused imports and variables are already blocked by ESLint
(`@typescript-eslint/no-unused-vars`, `--max-warnings 0`). Do not re-report
them; this check covers what single-file lint cannot see.

## knip (unused files, exports, dependencies)

Run from the repository root with the skill's config:

```bash
pnpm dlx knip@6.44.1 --config .claude/skills/cleanup/knip.json --no-progress --reporter compact
```

- If the command fails because the package cannot be fetched (offline,
  registry blocked), note it under Coverage and fall back to the grep checks
  below.
- If knip reports a config hint or an unresolved entry, fix nothing in the
  repo; mention it under Coverage so the config can be updated.
- Verify each result before listing it:
  - **Unused file:** grep for its basename and module path, including dynamic
    `import()` and string references (routes, vite config, scripts). Check
    `git log -1 --format=%cs -- <file>` for age.
  - **Unused export:** confirm no import anywhere, including tests. Exports
    used only by their own tests are P3 unless `keep.md` covers them.
  - **Unused dependency:** confirm no import, no CLI use in `package.json`
    scripts or workflows, and no config reference (`vite.config.ts`,
    `vitest*.config.ts`, `eslint.config.mjs`, `prisma.config.ts`).
  - **Unlisted dependency:** a workspace imports a package it does not declare
    — P1 (works only through hoisting).
- shadcn components under `apps/web/src/shared/components/ui/` that nothing
  imports are P3 and should be deleted whole, not edited.

## Environment variables

- List every variable parsed in `apps/api/src/config/env.ts` and every
  `import.meta.env.VITE_*` use in `apps/web/src`.
- Compare with `.env.example`, `.env.production.example`, `render.yaml`, and
  workflow files. Report variables declared but never read, and variables read
  but missing from the examples. Do not open real `.env` files.

## Scripts

- Every `package.json` script (root, `apps/api`, `apps/web`) must point at
  files that exist. Report scripts no workflow, doc, or other script uses as P3
  candidates, not as dead code (they may be manual tools).

## Leftovers

- Commented-out code blocks (three or more consecutive commented lines of
  code, not prose) in `apps/*/src`.
- `console.log`/`console.debug` in non-test source.
- `TODO`/`FIXME`/`HACK` comments: list with `git blame` date; older than six
  months is P2, otherwise P3.
- Feature flags or env switches that are always on/off in every environment.

## Lockfile

```bash
pnpm dedupe --check
```

Report duplicate versions that `dedupe` would collapse as one P3 item. Do not
run `pnpm dedupe` in report mode.
