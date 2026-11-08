# Client Data Flow

[Context index](../README.md). Notification persistence and cleanup: [data and storage](data-and-storage.md); coding conventions: [code standards](../engineering/code-standards.md).

## State Ownership

TanStack Query owns server state: fetches, mutations, loading/errors, optimistic updates, and invalidation. TanStack Store is only for small client/UI state such as active panels, temporary global filters, or layout preferences; never mirror API data there.

- Auth transitions cancel active client queries and clear the complete query and
  mutation cache before installing the next authenticated identity. A detected
  session loss or authenticated-user change applies the same reset. A per-client
  generation advances before cancellation starts. Mutation invocations capture
  that generation and fence request starts, responses, rollback, settlement, and
  caller callbacks, including same-user re-login. Optimistic callbacks remain
  synchronous; auth-changing mutations may accept only their own single
  generation advance. Superseded replacements cannot install an old identity.

## Notification Refresh

- The authenticated shell fetches the unread preview when it mounts.
- Notification queries refetch when the browser regains focus and when the dropdown or page opens.
- Current-browser mutations invalidate affected queries; there is no fixed-interval polling.
- Persisted notification responses remain backend-filtered against current membership, bans, progress, and content visibility.

## Performance

- Forward-only infinite queries retain at most five pages. Feed, comment,
  notification, moderation, search, joined-club, and unlock views therefore
  keep a bounded DOM/data window while users continue loading newer pages.
- Debounce networked search/filter controls.
- Use skeletons for feed, cards, panels, and route loads.
- Virtualize only when lists can grow large enough to need it.
- Keep optimistic updates small and easy to roll back.

See [API governance](../engineering/api-governance.md) for transport and retry semantics and [access policies](auth-and-access.md) for server-side visibility.
