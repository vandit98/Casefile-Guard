# Casefile Guard Architecture

## Product Boundary

Casefile Guard is not an AI classifier, a replacement for AutoModerator, or a cross-subreddit reputation network. It is a modmail casefile builder for repeat harassment and suspected burner-account evasion.

The winning wedge is narrow: moderators already know when a pattern is bad, but they lose time rebuilding context. Casefile Guard preserves the timeline and account links as the abuse happens.

## Default Moderator Journey

1. Install the app from the Devvit App Directory.
2. Add one or more specific watch phrases, or leave settings empty and use manual commands.
3. First match creates an open casefile and posts an internal modmail note.
4. Later matches append to the casefile by linked sender or durable phrase signal.
5. A mod can run `!case link CG-0001 username same person` from modmail or use the post/comment menu action.
6. A mod runs `!case summary CG-0001` to generate a clean escalation packet.

The first "this saves time" moment is the second related modmail conversation, when the app replies internally with the prior accounts, timestamps, and conversation IDs.

## Devvit Surfaces

- `onModMail`: primary ingestion path.
- Modmail API: fetch triggered conversations, post internal notes, archive, and optionally mute.
- Menu action on post/comment: manually link an author to a casefile.
- Subreddit menu action: post the open-case digest to mod discussions.
- Forms: collect case ID, username, and moderator note.
- Settings: response mode, phrase watchlist, username watchlist, excerpt policy, account-age signal, archive/mute policy, retention.
- Scheduler: retention cleanup placeholder. Redis TTLs do the actual v1 cleanup.
- Redis: per-subreddit case hashes, sorted event timelines, open-case index, user index, signal index.

## Redis Model

- `cg:case:<id>` stores case metadata.
- `cg:case:<id>:events` stores JSON event records in chronological sorted sets.
- `cg:case:<id>:accounts` stores linked usernames.
- `cg:<subreddit>:open` stores open case IDs by recent activity.
- `cg:<subreddit>:user:<username>` maps confirmed linked senders to open cases.
- `cg:<subreddit>:signal:<signal>` maps durable configured signals to open cases.

Event-level `retentionDays` is stripped before storage. It is used only to set TTLs.

## Safety Rules

- Auto-archive is disabled by default.
- Auto-archive only runs when the sender is already linked through the user index.
- Phrase matches can append to a case, but they do not confirm a sender.
- `!case` commands only run from internal/mod-authored modmail messages.
- Commands fail with internal help notes, not HTTP errors that cause noisy retries.
- Modmail triggers fail closed if the subreddit cannot be identified.
- Message excerpts can be disabled.
- Retention is bounded between 7 and 180 days.
- No external services, LLMs, or cross-subreddit sharing in v1.

## Launch Cutline

Ships in v1:

- Modmail trigger ingestion.
- Manual commands.
- Internal-note summaries.
- Redis persistence and retention.
- Post/comment author linking.
- Open-case digest.
- Local tests for scoring and storage behavior.

Deferred:

- Custom dashboard.
- Admin report submission automation.
- Saved response templates.
- Cross-community signal sharing.
- External classification.
