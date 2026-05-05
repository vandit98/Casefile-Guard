# Four-Week Build Plan

## Week 1

- Confirm pilot interest with at least three moderators.
- Upload a minimal Devvit app to a private test subreddit.
- Verify modmail trigger payload shape in playtest.
- Lock v1 storage schema.
- Decide whether message excerpts stay enabled by default after moderator feedback.

## Week 2

- Finish modmail case creation, append, summary, close, and manual link flows.
- Add settings validation and safe defaults.
- Add storage tests and fake Redis coverage.
- Run high-volume fake event tests locally.

## Week 3

- Install on at least one live subreddit.
- Collect false positives and confusing notes.
- Freeze feature scope.
- Polish App Directory copy, privacy text, and screenshots.
- Record first rough demo.

## Week 4

- Day 22-24: fix pilot issues only.
- Day 24: feature freeze.
- Day 25: final QA and App Directory listing.
- Day 26: final demo video and write-up.
- Day 27: submit.
- Day 28: buffer for platform or listing issues.

## Critical Path

The critical path is live Devvit modmail trigger reliability. If the app cannot ingest the triggered modmail message and post an internal note consistently, the project should cut every secondary feature and focus there.

## Owner Split

- Strongest Devvit engineer: trigger payloads, ModMail API calls, install/playtest stability.
- Backend engineer: Redis indexes, retention, tests.
- Product/modops lead: pilot outreach, settings copy, false-positive review.
- Demo owner: video script, app listing, submission proof.
