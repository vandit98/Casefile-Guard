# QA Checklist

## Local

- `node --check src/server/casefile-core.js`
- `node --check src/server/storage.js`
- `node --check src/server/index.js`
- `node --test test/*.test.mjs`
- `package.json` parses as JSON.
- `devvit.json` parses as JSON.
- `assets/icon.png` is present and at least 1024 by 1024.

## Devvit Playtest

- App installs on a test subreddit.
- Settings load with defaults.
- Invalid account-age, phrase-watchlist, username-watchlist, excerpt-length, and retention values are rejected.
- `onModMail` trigger fires for a new modmail message.
- Internal modmail note posts when a watch phrase matches.
- `!case new`, `!case add`, `!case link`, `!case summary`, `!case close`, and `!case help` work.
- A non-mod user sending text that starts with `!case` is ignored.
- Missing or invalid command arguments produce an internal help note and no case mutation.
- Post/comment menu action opens the link-author form.
- Subreddit menu action posts an open-case digest.
- Auto-archive does not run for phrase-only matches.
- Auto-archive runs only for already linked senders when explicitly enabled.

## Payload Capture

Record the first real playtest payload shape for:

- `onModMail` trigger: subreddit ID/name, conversation ID, message ID.
- Fetched ModMail conversation: where the subreddit, user, subject, and messages live.
- Post menu request: direct author fields and post ID fields.
- Comment menu request: direct author fields and comment ID fields.
- Form submission: whether subreddit context returns with `values`.

Delete or redact captured payloads after confirming field paths.

## Pilot

- Install on at least one live subreddit by week 3.
- Run with auto-archive off for the first 48 hours.
- Record every false positive and confusing internal note.
- Ask moderators whether the summary is concise enough to paste into an escalation report.
- Keep a before/after timer for evidence gathering.

## Submission

- App listing is live on developer.reddit.com.
- README and App Directory description say exactly what the app stores.
- Demo video includes a real end-to-end flow.
- Write-up includes pilot quotes or, if none are available, says the team could not secure a live pilot before submission.
- Developer feedback survey submitted.
- Helper nomination submitted if applicable.
