# Current Feature

Update this file only after the user and agent agree on the active feature scope.

After implementation is complete and the user asks to commit/merge into `main`, reset this file and add a concise entry to `feature-history.md`.

## Current Phase

- IN_PROGRESS

## Current Goal

- Add a My Clubs-local search bar.

## Active Feature

- Feature 80: My Clubs page search bar

## Scope

- Add an in-page search bar to My Clubs.
- Keep search scoped to joined clubs only.
- Preserve existing joined-club empty, no-match, loading, and pagination behavior.

## Out of Scope

- Global app-shell search restoration.
- Explore search/filter behavior changes.
- Backend API changes.

## Implementation Checklist

- [x] Requirements are clear.
- [x] Data model impact is understood.
- [x] API changes are defined.
- [x] Frontend changes are defined.
- [x] Auth, authorization, and progress/spoiler policies are defined.
- [x] Performance and pagination risks are considered.
- [x] Error, empty, loading, and denied states are considered.
- [x] Audit/logging requirements are considered.
- [x] Tests or verification steps are defined.
- [x] Context docs are updated where needed.

## In Progress

- My Clubs search UI.

## Next Up

- Implement and verify frontend search behavior.

## Open Questions

- None.

## Assumptions

- The existing `/api/users/me/clubs?q=` joined-club filtering remains the source of truth.

## Session Notes

- User requested the same local search bar pattern on My Clubs, adapted to joined clubs.
