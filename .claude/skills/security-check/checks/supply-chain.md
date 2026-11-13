# Supply chain and CI signals

CI already runs Gitleaks, CodeQL, and `pnpm audit` (see
`.github/workflows/`). Read their results instead of rerunning them, except
for the local audit below.

## GitHub alerts (repo `sen0mar/loresafe`)

Run if `gh auth status` succeeds; otherwise note it under Coverage.

```bash
gh api repos/sen0mar/loresafe/code-scanning/alerts --paginate -q '.[] | select(.state=="open") | [.rule.security_severity_level // .rule.severity, .rule.id, .most_recent_instance.location.path, .most_recent_instance.location.start_line] | @tsv'
```

```bash
gh api repos/sen0mar/loresafe/dependabot/alerts --paginate -q '.[] | select(.state=="open") | [.security_advisory.severity, .dependency.package.name, .security_advisory.summary] | @tsv'
```

```bash
gh api repos/sen0mar/loresafe/secret-scanning/alerts --paginate -q '.[] | select(.state=="open") | [.secret_type, .created_at] | @tsv'
```

```bash
gh run list --workflow release-gate.yml --branch main --limit 3
```

A 403/404 on an alerts endpoint means the feature is off or the token lacks
scope; report it under Coverage, not as a finding. Never print secret values
from secret-scanning alerts.

## Local dependency audit

```bash
pnpm audit --prod --audit-level moderate
```

## Changes since last run (`quick`) or overall (`full`)

- New direct dependencies in any `package.json`: note name, purpose, maintainer
  signal, and whether it has install scripts (`preinstall`, `install`,
  `postinstall`).
- `pnpm-lock.yaml` changes not from a Dependabot commit.
- `.github/workflows/*.yml`: every `uses:` pinned to a full commit SHA;
  `permissions:` least-privilege; no `pull_request_target` with checkout of PR
  code; no secrets echoed; downloaded binaries checksum-verified.
- `.gitleaks.toml` / `.gitleaksignore`: new allowlist entries need a reason.

## Local secret hygiene

- `git ls-files` must not include `.env` or `.env.*` other than the
  `*.example` files.
- Committed `*.example` files and `context/` docs contain placeholders only.
- Do not open or print the local `.env` files.
