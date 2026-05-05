# Casefile Guard

Casefile Guard is a Devvit moderation app for repeat modmail harassment, ban-evasion patterns, and burner-account waves.

It does not try to be an AI moderator. Its job is narrower: turn repeated abusive modmail into a quiet, reviewable casefile so moderators stop rebuilding the same evidence packet by hand.

## What It Does

- Watches modmail via Devvit's `onModMail` trigger.
- Creates a casefile when a configured watch phrase, watched username, or repeated linked sender appears.
- Groups future modmail by confirmed linked sender or durable signal, such as the same configured phrase.
- Keeps safety boundaries clear: phrase matches append to a case, but auto-archive only runs for confirmed linked senders.
- Posts internal modmail notes with a compact timeline.
- Supports explicit modmail commands:
  - `!case new <label>`
  - `!case add <case id> <note>`
  - `!case link <case id> <username> <note>`
  - `!case summary <case id>`
  - `!case close <case id> <note>`
  - `!case help`
- Adds a moderator menu action to link a post/comment author to a casefile.
- Uses per-subreddit Redis storage with short retention.
- Defaults to safe observe/internal-note behavior. Auto-archive is opt-in.

## Why This Is Hackathon-Shaped

Mods in r/ModSupport repeatedly describe burner accounts spamming modmail, manual ban-evasion reports, and the pain of listing prior account names and modmail links. Casefile Guard attacks that exact workflow rather than adding another broad dashboard.

## Setup

Install dependencies and run the local test suite:

```sh
npm install
npm test
npm run dev
```

Then upload and install:

```sh
npm run upload
devvit install <your-test-subreddit> casefile-guard
```

## Devvit Settings

Default response mode:
Controls whether Casefile Guard only observes or posts internal modmail notes.

Auto-archive confirmed cases:
Disabled by default. When enabled, new modmail from an account already linked to an open casefile is archived after being logged.

Mute auto-archived conversations:
Optional 72-hour, 7-day, or 28-day mute.

Watch phrases:
Comma- or newline-separated signals for repeat abuse. Keep these specific to avoid false positives.

Username watchlist:
Optional known burner or abusive usernames. These create/link casefiles without waiting for a phrase match.

Store message excerpts:
Enabled by default, with a bounded excerpt length. Disable this if a community wants IDs and timelines without storing message text snippets.

Retention:
Defaults to 30 days. App review and moderator trust both depend on not storing harassment data indefinitely.

## Impact Metrics

Casefile Guard is designed to measure practical moderator time savings:

- Number of abusive modmail conversations grouped.
- Number of linked burner accounts.
- Time to create an escalation packet before vs after.
- False positive count.
- Whether moderators choose to enable opt-in auto-archive for confirmed repeat senders.

## Test Status

Local verification covers the parts that do not require a live Devvit runtime:

```sh
node --check src/server/casefile-core.js
node --check src/server/storage.js
node --check src/server/index.js
node --test test/*.test.mjs
```

Current local result: 18 passing tests.
