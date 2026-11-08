# LoreSafe

[Context index](../README.md). Detailed behavior: [access policies](../architecture/auth-and-access.md); visual requirements: [UI](ui.md).

## Overview

LoreSafe is a progress-aware social discussion app for books, shows, anime, manga, films, games, podcasts, courses, and custom story timelines. Users join clubs, set their progress, and only see discussions, comments, notifications, and media that are safe for their current point in the story.

The initial version should stay focused on the spoiler-safe social loop: create/join a club, define milestones, update progress, discuss safely, and moderate mistakes.

## Core Problem

Normal discussion spaces rely on manual spoiler tags. LoreSafe makes spoiler safety a system rule by attaching content visibility to each user's progress.

## Primary Users

- Readers/viewers/players who want to discuss stories without accidental spoilers.
- Club owners who create structured spaces around a title or custom timeline.
- Moderators who correct spoiler levels, handle reports, and keep clubs safe.

## Core User Flows

- **Member:** sign up/log in → discover/join club → set per-club progress/mode → browse safe discussions → post/comment at a milestone → advance progress and unlock content.
- **Owner:** create a club with title, category, visibility, cover, and rules → build/import ordered milestones → invite members or publish → manage members, moderators, reports, and settings.
- **Moderator:** review spoiler reports → correct progress requirements, hide/delete content, warn, or ban → resolve with notes and audit history.

## MVP Scope

### Accounts and Profiles

- Account-neutral signup with email verification, login/logout, password
  recovery, and authenticated profile.
- Optional one-click access to an isolated seeded demo account when public demo
  credentials are configured for the web build.
- Locked username at signup, plus avatar/display name basics.
- Joined clubs and per-club progress.

### Clubs and Membership

- Create public, private, and invite-only clubs with a fixed media-type category.
- Join public clubs or private clubs through invite links.
- Roles: owner, moderator, member.
- Basic club settings and rules.

### Milestones and Progress

- Custom milestone builder with ordered milestones.
- Basic templates for books, shows, movies, games, podcasts/courses, and custom timelines.
- Manual progress update and quick “next milestone complete”.
- Progress history.
- Modes: Strict, Brave, Finished.

### Spoiler-Safe Discussion

- Posts with required progress.
- Comments that inherit the post level by default and can require a later milestone.
- Safe feed, locked placeholders, and basic feed tabs: safe, locked, all, my posts, unanswered.
- Basic post types: discussion, question, theory, prediction, poll, reaction, review, image/meme, quote/commentary, and “I just reached this part”.

### Reactions, Notifications, and Unlocks

- Emoji reactions.
- Spoiler-safe notification text.
- Recently unlocked page after progress updates.
- Basic prediction creation and reveal.

### Moderation and Safety

- Spoiler reports.
- Moderator queue.
- Adjust spoiler level, hide/delete content, warn, ban, resolve, and add notes.
- Audit logs for moderation/admin/security actions.
- Rate limits on sensitive and expensive actions.

## Out of Scope for MVP

- External media database integrations.
- Full global search beyond PostgreSQL full-text search.
- Live watch/read-along rooms.
- Private buddy threads and “people near me”.
- Advanced prediction scoring, leaderboards, awards, and voting.
- Unlock party, heatmaps, memory lane, badges, streaks, and analytics dashboards.
- AI spoiler detection.
- Exportable archives.
- Billing or paid plans.

## Success Criteria

1. A user can create a club, define milestones, join it, set progress, and browse a personalized feed.
2. Users behind a required milestone receive only safe metadata or locked placeholders.
3. Users at or beyond a required milestone can read and reply.
4. Private and invite-only clubs cannot be accessed without membership/invite authorization.
5. Owners and moderators can resolve spoiler reports without direct database edits.
6. Progress updates unlock new content without exposing future content in notifications or API responses.
7. List endpoints are paginated and indexed for the expected feed, notification, report, and membership queries.
8. Auth, uploads, posts, comments, reports, invites, and progress updates are rate-limited.
9. Sensitive actions are logged in audit records where needed.
10. The UI matches the dark, compact, steel-blue-accented reference direction.
