# Demo Video Script

Target length: 2 to 3 minutes.

## 0:00-0:15 - Pain

"Moderators dealing with repeat modmail harassment often have to reread abuse, remember prior burner accounts, and rebuild the same escalation packet by hand. Casefile Guard turns that into a quiet casefile as the messages arrive."

Show a test subreddit modmail conversation with a configured phrase.

## 0:15-0:55 - Core Unlock

Trigger the first abusive modmail message. Show the internal modmail note:

- Case ID.
- Status.
- Linked accounts.
- Timeline event.
- Reason it matched.

Trigger a second message from another account with the same phrase. Show that it appends to the same case by signal without auto-archiving the new sender.

## 0:55-1:25 - Manual Mod Workflow

Use `!case link CG-0001 burner_three same person` in modmail, then show the post/comment menu action "Add author to casefile" as the second path.

Then show a new modmail from that linked username. It appends to the case and, if opt-in archive is enabled for the demo, archives only because the sender is confirmed.

## 1:25-1:55 - Configuration

Open settings:

- Response mode defaults to internal notes.
- Auto-archive is off by default.
- Watch phrases and username watchlist are optional.
- Excerpts can be disabled.
- Retention is bounded.

Emphasize install friction: useful with only a phrase watchlist, safe with no automation enabled.

## 1:55-2:25 - Technical Depth

Show the Devvit pieces:

- `onModMail` trigger.
- Redis case timeline.
- User and signal indexes.
- No external services.
- TTL-based retention.

Mention local test coverage for scoring, privacy settings, indexing, signal grouping, and closed-case behavior.

## 2:25-2:45 - Impact

"In a pilot, we are measuring minutes to produce an escalation packet before and after Casefile Guard, number of conversations grouped, number of linked accounts, and false positives. The goal is not more automation. It is less repeated exposure to the same abuse."
