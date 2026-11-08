# Context Documentation

Read documents selectively by task; this directory describes current decisions, not an implementation log. [AGENTS.md](../AGENTS.md) is the task routing guide.

| Document                                                           | Owns                                                                                  |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| [Product](product/overview.md)                                     | Users, goals, flows, MVP scope, success criteria                                      |
| [Architecture overview](architecture/overview.md)                  | Stack, system boundaries, request flow, core invariants                               |
| [Auth and access](architecture/auth-and-access.md)                 | Accounts, sessions, authorization, spoiler/search safety, diagnostic redaction        |
| [Data and storage](architecture/data-and-storage.md)               | Data model, migrations, uploads, transactions, cleanup, database performance          |
| [Client data flow](architecture/client-data-flow.md)               | State ownership, identity/cache transitions, notification refresh, client performance |
| [Deployment and delivery](architecture/deployment-and-delivery.md) | Hosting, environment, CI, repository protections, release gates                       |
| [API governance](engineering/api-governance.md)                    | Contracts, transport, caching, errors, pagination, limits, compatibility              |
| [Code standards](engineering/code-standards.md)                    | Code/module organization, conventions, testing                                        |
| [UI](product/ui.md)                                                | Theme, shared components, layouts, responsive behavior, accessibility                 |
| [Workflow](engineering/workflow.md)                                | Feature lifecycle, scope, documentation ownership, handoff                            |
| [Operations](operations/runbook.md)                                | Health, recovery, retention cleanup, incidents, rollback                              |
| [Privacy inventory](operations/privacy-data-inventory.md)          | Data categories, providers, purposes, retention inventory                             |

Folders group product/design, architecture, engineering practices, operations/privacy, active/history feature plans, and image references. Only this index lives at the context root.

Update the document that owns a decision and link to it elsewhere. Overview and agent-guide safety summaries are intentional; detailed rules belong only in their owning document. The privacy inventory summarizes retention windows; the runbook owns cleanup and recovery procedures. Keep current implementation state in [the current feature](features/current-feature.md); consult [feature history](features/feature-history.md) only when history is needed. Images remain visual references.
