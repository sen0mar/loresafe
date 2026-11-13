# Docs and config drift

Documentation ownership: `context/engineering/workflow.md`. Fix docs only in
`apply`, never in `report`.

## `context/` and READMEs

- Every file path, script name (`pnpm ...`), env variable, and route mentioned
  in `context/**/*.md`, `README.md`, and `AGENTS.md` must exist. Missing ones
  are P1 (docs pointing at removed code mislead agents and people).
- Relative Markdown links must resolve.
- `context/features/current-feature.md` describing work that is already merged
  (check `git log`) — P2; the content belongs in `feature-history.md`.
- Do not rewrite `feature-history.md`; it is historical.

## Config

- `tsconfig*.json` `include`/`exclude` and path entries that match no files —
  P3.
- ESLint `files`/`ignores` globs in `eslint.config.mjs` that match no files —
  P3.
- `.prettierignore` / `.gitignore` entries for paths that no longer exist —
  P3.
- `pnpm-workspace.yaml` `overrides` whose comment says "until X bundles it
  upstream": check whether the dependency now ships the patched version; if
  so, report as P2 "override may be removable" (do not remove in `apply`
  without running `pnpm audit --prod`).
- `vercel.json` rewrites/headers for routes that no longer exist in
  `apps/web/src` — P3.
