# Research Sources

Use this file to keep the submission's factual claims honest.

## Verified

- Hackathon dates, prize categories, deliverables, and judging criteria: https://mod-tools-migration.devpost.com/
- Devvit Web `devvit.json` configuration, server entry, triggers, scheduler, menu items, forms, marketing assets, and CJS server requirement: https://developers.reddit.com/docs/capabilities/devvit-web/devvit_web_configuration
- Devvit settings and secrets, subreddit-scoped settings, validation endpoints, and setting types: https://developers.reddit.com/docs/capabilities/server/settings-and-secrets
- Devvit Web menu response shape, including `showForm.name`, nested `form`, and `data` for defaults: https://developers.reddit.com/docs/capabilities/client/forms
- Devvit Web menu item locations and moderator-only menu actions: https://developers.reddit.com/docs/capabilities/client/menu-actions
- Devvit Redis per-installation namespacing and current API shape, including `zAdd(key, ...members)` and `zRange` returning member/score objects: https://developers.reddit.com/docs/capabilities/server/redis
- Devvit ModMail API support for `getConversation`, `reply`, `archiveConversation`, `muteConversation`, and `createModDiscussionConversation`: https://developers.reddit.com/docs/api/redditapi/models/classes/ModMailService
- Devvit Reddit API supports `reddit.getCommentById` and `reddit.getPostById`: https://developers.reddit.com/docs/capabilities/server/reddit-api

## Assumed Until Playtest

- Exact `onModMail` trigger payload shape for subreddit ID/name and message ID. The app falls back from trigger payload to fetched conversation data, but this must be confirmed in `devvit playtest`.
- Exact menu request payload shape for post/comment author IDs. The app tries direct author fields, comment ID lookup, and post ID lookup.
- App account moderator permissions granted during install are sufficient for internal modmail replies, archive, and mute in the target subreddit.
