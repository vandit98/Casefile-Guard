# Privacy Policy

Casefile Guard stores only the moderation context needed to help a subreddit team manage repeat modmail harassment or suspected evasion.

## Data Stored

- Casefile ID, label, status, and timestamps.
- Usernames linked to a casefile.
- Modmail conversation IDs.
- Short excerpts from modmail messages for moderator context, unless the subreddit disables excerpt storage.
- Moderator-provided notes.

## Data Not Stored

- Private user data unrelated to the installed subreddit.
- Votes, subscriptions, saved posts, or recently viewed content.
- Full profile histories.
- Data from other subreddits.

## Retention

The default retention setting is 30 days. Moderators can configure retention from 7 to 180 days. Casefile data is stored in Reddit-hosted Devvit Redis for the app installation.

Message excerpt length is bounded by app settings. The app does not store full modmail transcripts.

## External Services

V1 does not call external services and does not send data outside Reddit's Developer Platform.

## Deletion

The app is designed to honor Reddit deletion requirements. Short retention is the primary V1 safeguard; future versions will add item-level purge behavior as delete trigger payloads are verified in playtest.
