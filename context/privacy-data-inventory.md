# Privacy Data Inventory

This operational inventory supports the public Privacy Policy. Update it when
LoreSafe adds a provider, data category, or materially different retention rule.

| Category                                                                                  | Purpose                                                | Primary location/provider                                    | Current retention                                                |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------ | ---------------------------------------------------------------- |
| Account/profile and password hashes                                                       | Account access and profile features                    | Neon PostgreSQL                                              | Active account lifetime; deleted with the account                |
| Session hashes, family IDs, and generations                                               | Revocable sign-in                                      | Neon PostgreSQL; Secure HttpOnly cookies hold browser tokens | Session expiry/revocation                                        |
| Spent refresh-token hashes                                                                | Replay detection                                       | Neon PostgreSQL                                              | 24 hours; bounded request-driven purge                           |
| IP rate-limit keys and counters                                                           | Abuse and credential protection                        | Upstash Redis                                                | Configured limiter window                                        |
| Clubs, memberships, progress, content, reactions, predictions, reports, and notifications | Spoiler-safe social and moderation features            | Neon PostgreSQL                                              | Active account/content lifetime or user/moderator deletion       |
| Moderation audit records                                                                  | Safety accountability and incident review              | Neon PostgreSQL                                              | 365 days; deleted-account actor snapshots anonymized immediately |
| Security events                                                                           | Account compromise investigation and user notification | Neon PostgreSQL                                              | 365 days; bounded request-driven purge                           |
| Avatars, club covers, and post media                                                      | User-requested media delivery                          | Cloudflare R2 plus Neon metadata                             | Active asset lifetime; recovery versions at least 14 days        |
| Error and performance diagnostics                                                         | Reliability and incident response                      | Sentry                                                       | Configured Sentry project retention                              |
| Web/API hosting request processing                                                        | Deliver the application                                | Vercel and Render                                            | Provider operational retention settings                          |
| PostgreSQL and R2 recovery copies                                                         | Disaster recovery                                      | Neon and Cloudflare                                          | At least 14 days                                                 |
| Browser preferences and non-secret session hint                                           | Interface preference and signed-out optimization       | Browser local storage                                        | Until cleared by the user/app                                    |

Public avatars, public club covers, and public club metadata can be publicly
retrievable. Spoiler-sensitive media remains backend-authorized. Never record
passwords, raw tokens, cookies, private signed URLs, or unnecessary personal
details in audit metadata, logs, Sentry events, or moderator notes.
