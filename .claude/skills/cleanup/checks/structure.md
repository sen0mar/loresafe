# Structure and refactor opportunities

## Large files

List non-test, non-generated source files over 500 lines:

```bash
find apps -type f \( -name '*.ts' -o -name '*.tsx' \) -not -path '*/node_modules/*' -not -path '*/generated/*' -not -path '*/dist/*' -not -name '*.test.*' -not -path '*/components/ui/*' -print0 | xargs -0 wc -l | sort -rn | awk '$1 > 500 && $2 != "total"'
```

For each one, do not just report the size. Read it and propose **where** to
split, using seams that already exist in the repo:

- Repositories: split into command and query repositories behind contracts,
  as `clubs`, `reports`, and `progress` already partly do; or by sub-resource
  (members, bans, settings).
- Web mutation hook files: one file per resource or per mutation group.
- Pages: extract sections into feature components; move data shaping into the
  feature's `api` or a pure helper.
- `apps/api/src/openapi/openapi.ts`: split by route group only if the generator
  output stays identical (`pnpm api:contract:check`).

Splits are usually effort `L`. Mark P2 if the file is changed often
(`git log --since=3.months --format= --name-only -- <file> | wc -l` is high),
otherwise P3.

## Duplication

```bash
pnpm dlx jscpd@4.3.0 --min-lines 12 --min-tokens 80 --reporters console --silent --ignore "**/node_modules/**,**/generated/**,**/dist/**,**/coverage/**,**/*.test.*,**/components/ui/**,**/migrations/**" apps
```

- If the tool is unavailable, skip and note it under Coverage.
- Report only duplication with at least two real call sites that would share
  one helper without adding a speculative abstraction (code standards: no
  global abstraction before two real call sites).
- Duplicated authorization, redaction, or validation logic is
  `security-sensitive` — report it, never merge it in `apply`.

## Module boundaries

- Cross-module imports that reach into another module's repository or
  internals instead of its service or contract — P2.
- Circular imports between modules (follow imports manually if no tool is
  available) — P2.
- `apps/web` imports from `apps/api` other than the shared scrubber module the
  architecture docs allow — P1.
