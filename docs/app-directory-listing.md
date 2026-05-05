# App Directory Listing Draft

## Name

Casefile Guard

## Short Description

Turn repeat modmail harassment into one quiet, mod-only casefile.

## Long Description

Casefile Guard helps subreddit teams handle repeat modmail harassment, suspected burner-account waves, and ban-evasion patterns without rebuilding the same evidence packet by hand.

The app watches incoming modmail, creates a casefile when a configured phrase or watched username appears, and appends later related conversations by confirmed linked sender or durable signal. It posts compact internal modmail notes with accounts, timestamps, conversation IDs, and reasons. Moderators can also use `!case` commands or post/comment menu actions to link authors manually.

Casefile Guard is intentionally narrow. It is not an AI moderator, not a cross-subreddit reputation database, and not an automatic admin-report submitter. Auto-archive is off by default and can only run for users already linked to an open casefile.

## Moderator Setup

1. Install the app.
2. Add one or more specific watch phrases, or leave watchlists empty and use manual `!case` commands.
3. Keep auto-archive disabled until the team trusts the workflow.
4. Use `!case summary <case id>` when you need an escalation packet.

## Privacy Copy

Casefile Guard stores case IDs, linked usernames, modmail conversation IDs, moderator notes, short message excerpts, and timestamps in Devvit Redis for the installed subreddit. Message excerpts can be disabled. Retention defaults to 30 days and can be configured from 7 to 180 days. The app does not call external services.

## Screenshot Plan

- Settings page with auto-archive disabled and retention visible.
- Internal modmail note showing one casefile timeline.
- `!case summary` escalation packet.
- Post/comment menu action form.
