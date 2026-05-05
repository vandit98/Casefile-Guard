# Hackathon Submission Outline

## Hook

Casefile Guard turns repeat modmail harassment into one quiet evidence packet, so moderators stop rereading abuse and rebuilding ban-evasion reports by hand.

## The Pain

Use a direct moderator quote from pilot outreach. Pair it with public evidence from r/ModSupport about burner accounts spamming modmail and mods manually listing prior accounts.

## What It Does

1. Watches incoming modmail.
2. Links repeat senders, watched usernames, and durable phrase matches into casefiles.
3. Posts internal modmail notes with a timeline and escalation packet.
4. Lets mods manually add post/comment authors, link usernames from modmail, or close cases.
5. Optionally archives confirmed repeat-sender conversations.

Safety claim to make explicit: phrase matches can group evidence, but only confirmed linked senders can trigger auto-archive.

## Communities Helped

Replace with confirmed pilots:

- r/Scams: repeat scammer and burner-account modmail patterns.
- r/AskDocs: high-volume rule enforcement and hostile appeals.
- r/legaladvice: recurring banned users, legal-advice rule disputes, and appeal load.

WAU estimates are assumed until moderators provide private insights or Reddit-visible data.

## Measured Impact

Report:

- Before: average minutes to gather account list, links, and prior conversations.
- After: time to review Casefile Guard packet.
- Number of conversations grouped.
- False positives.

## Technical Highlights

- Devvit Web server app with Hono.
- `onModMail` trigger for push-based ingestion.
- Reddit ModMail API for conversation fetch, internal replies, archive, and mute.
- Redis hashes and sorted sets for per-subreddit casefiles.
- Separate user and durable-signal indexes so the app can group related modmail without over-confirming ban evasion.
- No external services.
- Retention defaults to 30 days.
- Message excerpts can be disabled by subreddit setting.

## Roadmap

- Better modmail command UX.
- Casefile dashboard as a custom post or settings page once pilot feedback confirms desired surfaces.
- Optional saved-response templates for escalation packets.
- Broader integrations only after privacy review.
