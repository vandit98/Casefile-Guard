"use strict";

const { Hono } = require("hono");
const { redis } = require("@devvit/redis");
const { reddit, settings } = require("@devvit/web/server");
const {
  buildCommandHelp,
  buildCaseSummary,
  buildEscalationPacket,
  classifyModmailMessage,
  eventFromMessage,
  extractTriggeredMessage,
  mergeSettings,
  normalizeCaseId,
  normalizeUsername,
  scoreModmail,
  validatePhraseWatchlist,
  validateUsernameWatchlist,
} = require("./casefile-core");
const storage = require("./storage");

const app = new Hono();

async function getConfig() {
  const keys = [
    "casefileMode",
    "autoArchiveConfirmedCases",
    "muteArchivedConversations",
    "phraseWatchlist",
    "usernameWatchlist",
    "minimumAccountAgeDays",
    "storeMessageExcerpts",
    "maxExcerptCharacters",
    "retentionDays",
  ];
  const values = await Promise.all(keys.map((key) => settings.get(key).catch(() => undefined)));
  return mergeSettings(Object.fromEntries(keys.map((key, index) => [key, values[index]])));
}

function getSubredditName(input = {}) {
  const value =
    input.subreddit?.name ||
    input.subreddit?.displayName ||
    input.subreddit?.displayNamePrefixed ||
    input.owner?.name ||
    input.owner?.displayName ||
    input.subredditName ||
    (typeof input.subreddit === "string" ? input.subreddit : "");
  return normalizeSubredditName(value);
}

function getSubredditId(input = {}) {
  return input.subreddit?.id || input.subredditId || input.owner?.id || "";
}

function getSubredditKey(input = {}) {
  return getSubredditId(input) || getSubredditName(input) || "unknown";
}

function normalizeSubredditName(value) {
  return String(value || "").trim().replace(/^r\//i, "");
}

async function postInternalNote(conversationId, body) {
  if (!conversationId) return false;
  return reddit.modMail.reply({
    conversationId,
    body,
    isInternal: true,
    isAuthorHidden: true,
  });
}

async function maybeArchive(conversationId, config) {
  if (!config.autoArchiveConfirmedCases) return { archived: false, muted: false };
  try {
    await reddit.modMail.archiveConversation(conversationId);
    const muteHours = String(config.muteArchivedConversations || "none");
    if (["72", "168", "672"].includes(muteHours)) {
      await reddit.modMail.muteConversation({ conversationId, numHours: Number(muteHours) });
      return { archived: true, muted: true };
    }
    return { archived: true, muted: false };
  } catch (error) {
    console.error("Casefile Guard archive/mute failed", error?.message || error);
    return { archived: false, muted: false, error: "archive_failed" };
  }
}

async function safePostInternalNote(conversationId, body) {
  try {
    await postInternalNote(conversationId, body);
    return true;
  } catch (error) {
    console.error("Casefile Guard internal note failed", error?.message || error);
    return false;
  }
}

async function resolveTargetAuthor(input = {}) {
  const direct =
    input.author?.name ||
    input.author?.username ||
    input.authorName ||
    input.username ||
    input.user?.name ||
    input.user?.username ||
    "";
  if (direct) return normalizeUsername(direct);

  const commentId = input.commentId || input.comment?.id || input.target?.commentId || input.context?.commentId;
  if (commentId) {
    try {
      const comment = await reddit.getCommentById(commentId);
      return normalizeUsername(comment.authorName || comment.author?.name || comment.author?.username || comment.authorId);
    } catch {
      return "";
    }
  }

  const postId = input.postId || input.post?.id || input.target?.postId || input.context?.postId;
  if (postId) {
    try {
      const post = await reddit.getPostById(postId);
      return normalizeUsername(post.authorName || post.author?.name || post.author?.username || post.authorId);
    } catch {
      return "";
    }
  }

  return "";
}

function makeCaseEvent(message, score, config, extra = {}) {
  return eventFromMessage(message, {
    reasons: score.reasons,
    signals: score.signals,
    storeExcerpt: config.storeMessageExcerpts !== false && config.storeMessageExcerpts !== "false",
    excerptLength: config.maxExcerptCharacters,
    retentionDays: config.retentionDays,
    ...extra,
  });
}

app.post("/internal/triggers/app-install", async (c) => {
  return c.json({ status: "ok" });
});

app.post("/internal/triggers/app-upgrade", async (c) => {
  return c.json({ status: "ok" });
});

app.post("/internal/triggers/modmail", async (c) => {
  const trigger = await c.req.json();
  let subreddit = getSubredditKey(trigger);
  const config = await getConfig();
  const conversationId = trigger.conversationId;

  if (!conversationId) return c.json({ status: "ignored", reason: "missing conversationId" });

  const conversationResult = await reddit.modMail.getConversation({
    conversationId,
    markRead: false,
  });
  const conversationSubreddit = getSubredditKey(conversationResult.conversation || conversationResult);
  if (subreddit === "unknown" && conversationSubreddit !== "unknown") subreddit = conversationSubreddit;
  if (subreddit === "unknown") {
    const notePosted = await safePostInternalNote(
      conversationId,
      "Casefile Guard could not determine the subreddit for this modmail trigger, so it did not create or update a casefile."
    );
    return c.json({ status: "ignored", reason: "missing subreddit", notePosted });
  }
  const message = extractTriggeredMessage(conversationResult, trigger);

  const classification = classifyModmailMessage(message);
  if (classification.type === "command") {
    return handleCaseCommand(c, { command: classification.command, message, subreddit, config });
  }
  if (classification.type === "ignored") {
    return c.json({ status: "ignored", reason: classification.reason });
  }

  const knownCase = await storage.findOpenCaseForUser(redis, subreddit, message.author);
  const score = scoreModmail({
    message,
    user: conversationResult.user,
    settings: config,
    knownCase,
  });
  const signalCase = knownCase ? null : await storage.findOpenCaseForSignals(redis, subreddit, score.signals);
  const matchedCase = knownCase || signalCase?.caseFile;

  if (matchedCase && (score.shouldAppendToCase || signalCase)) {
    const event = makeCaseEvent(message, score, config, {
      reasons: signalCase ? [...score.reasons, `matched existing case signal: ${signalCase.signal}`] : score.reasons,
    });
    await storage.appendEvent(redis, matchedCase.id, event);
    const events = await storage.listCaseEvents(redis, matchedCase.id);
    const summary = buildCaseSummary(matchedCase, events);
    const notePosted = config.casefileMode === "internal-note" ? await safePostInternalNote(conversationId, summary) : false;
    const archiveResult = knownCase ? await maybeArchive(conversationId, config) : { archived: false, muted: false };
    return c.json({
      status: "ok",
      action: "appended",
      caseId: matchedCase.id,
      matchedBy: signalCase?.signal || "user",
      notePosted,
      ...archiveResult,
    });
  }

  if (score.shouldCreateCase) {
    const event = makeCaseEvent(message, score, config);
    const caseFile = await storage.createCase(redis, {
      subreddit,
      label: "Modmail harassment / possible evasion",
      createdBy: "casefile-guard",
      seedEvent: event,
    });
    await storage.applyRetention(redis, caseFile, config.retentionDays);
    const summary = buildCaseSummary(caseFile, [event]);
    const notePosted = config.casefileMode === "internal-note" ? await safePostInternalNote(conversationId, summary) : false;
    return c.json({ status: "ok", action: "created", caseId: caseFile.id, notePosted });
  }

  return c.json({ status: "ignored", score: score.score });
});

async function handleCaseCommand(c, { command, message, subreddit, config }) {
  if (command.action === "help") {
    const body = command.invalid
      ? `${buildCommandHelp()}\n\nI did not recognize that command, so I did not change any casefiles.`
      : buildCommandHelp();
    const notePosted = await safePostInternalNote(message.conversationId, body);
    return c.json({ status: "ok", action: "help", notePosted });
  }

  if (command.action === "new") {
    const event = eventFromMessage(message, {
      reasons: ["manual !case new command"],
      storeExcerpt: config.storeMessageExcerpts !== false && config.storeMessageExcerpts !== "false",
      excerptLength: config.maxExcerptCharacters,
      retentionDays: config.retentionDays,
    });
    const caseFile = await storage.createCase(redis, {
      subreddit,
      label: command.label,
      createdBy: message.author,
      seedEvent: event,
    });
    await storage.applyRetention(redis, caseFile, config.retentionDays);
    const summary = buildCaseSummary(caseFile, [event]);
    const notePosted = await safePostInternalNote(message.conversationId, summary);
    return c.json({ status: "ok", action: "created", caseId: caseFile.id, notePosted });
  }

  if (command.action === "add") {
    const caseId = normalizeCaseId(command.caseId);
    if (!caseId) return commandNotice(c, message, "Add this conversation with `!case add <case id> <note>`.");
    const caseFile = await storage.getCase(redis, caseId);
    if (!caseFile) return commandNotice(c, message, `I could not find casefile ${caseId}.`);

    const event = eventFromMessage(message, {
      reasons: ["manual !case add command", command.note].filter(Boolean),
      storeExcerpt: config.storeMessageExcerpts !== false && config.storeMessageExcerpts !== "false",
      excerptLength: config.maxExcerptCharacters,
      retentionDays: config.retentionDays,
    });
    await storage.appendEvent(redis, caseId, event);
    const events = await storage.listCaseEvents(redis, caseId);
    const notePosted = await safePostInternalNote(message.conversationId, buildCaseSummary(caseFile, events));
    return c.json({ status: "ok", action: "appended", caseId, notePosted });
  }

  if (command.action === "link") {
    const caseId = normalizeCaseId(command.caseId);
    const username = normalizeUsername(command.username);
    if (!caseId || !username) {
      return commandNotice(c, message, "Link a user with `!case link <case id> <username> <note>`.");
    }
    const caseFile = await storage.getCase(redis, caseId);
    if (!caseFile) return commandNotice(c, message, `I could not find casefile ${caseId}.`);

    await storage.linkUserToCase(redis, {
      subreddit,
      username,
      caseId,
      note: command.note || `Linked from modmail conversation ${message.conversationId}.`,
      retentionDays: config.retentionDays,
    });
    const events = await storage.listCaseEvents(redis, caseId);
    const notePosted = await safePostInternalNote(message.conversationId, buildCaseSummary(caseFile, events));
    return c.json({ status: "ok", action: "linked", caseId, username, notePosted });
  }

  if (command.action === "summary") {
    const caseId = normalizeCaseId(command.caseId);
    if (!caseId) return commandNotice(c, message, "Summarize a case with `!case summary <case id>`.");
    const caseFile = await storage.getCase(redis, caseId);
    if (!caseFile) return commandNotice(c, message, `I could not find casefile ${caseId}.`);
    const events = await storage.listCaseEvents(redis, caseId, 50);
    const notePosted = await safePostInternalNote(message.conversationId, buildEscalationPacket(caseFile, events));
    return c.json({ status: "ok", action: "summarized", caseId, notePosted });
  }

  if (command.action === "close") {
    const caseId = normalizeCaseId(command.caseId);
    if (!caseId) return commandNotice(c, message, "Close a case with `!case close <case id> <note>`.");
    const caseFile = await storage.closeCase(redis, caseId, command.note);
    if (!caseFile) return commandNotice(c, message, `I could not find casefile ${caseId}.`);
    const notePosted = await safePostInternalNote(
      message.conversationId,
      `Casefile ${caseId} closed.${command.note ? ` Note: ${command.note}` : ""}`
    );
    return c.json({ status: "ok", action: "closed", caseId, notePosted });
  }

  return c.json({ status: "ignored" });
}

async function commandNotice(c, message, body) {
  const notePosted = await safePostInternalNote(message.conversationId, body);
  return c.json({ status: "invalid_command", notePosted });
}

app.post("/internal/menu/show-digest", async (c) => {
  const input = await c.req.json().catch(() => ({}));
  const subreddit = getSubredditKey(input);
  const subredditId = getSubredditId(input);
  const cases = await storage.listOpenCases(redis, subreddit, 10);

  if (!cases.length) {
    return c.json({ showToast: "Casefile Guard: no open casefiles yet." });
  }

  if (!subredditId) {
    return c.json({ showToast: "Casefile Guard could not find the subreddit ID for this menu request." });
  }

  const summaries = [];
  for (const caseFile of cases) {
    const events = await storage.listCaseEvents(redis, caseFile.id, 5);
    summaries.push(buildCaseSummary(caseFile, events, { limit: 5 }));
  }

  await reddit.modMail.createModDiscussionConversation({
    subredditId,
    subject: "Casefile Guard open case digest",
    bodyMarkdown: summaries.join("\n\n---\n\n"),
  });

  return c.json({ showToast: `Casefile Guard posted ${cases.length} open casefile summaries to mod discussions.` });
});

app.post("/internal/menu/add-author-to-case", async (c) => {
  const input = await c.req.json().catch(() => ({}));
  const username = await resolveTargetAuthor(input);
  return c.json({
    showForm: {
      name: "addAuthorToCase",
      form: {
        title: "Add author to casefile",
        acceptLabel: "Link Author",
        fields: [
          {
            type: "string",
            name: "caseId",
            label: "Case ID",
            placeholder: "CG-0001",
            required: true,
          },
          {
            type: "string",
            name: "username",
            label: "Username",
            placeholder: "username",
            required: true,
          },
          {
            type: "paragraph",
            name: "note",
            label: "Moderator note",
            placeholder: "Why this author belongs in the casefile",
            required: false,
          },
        ],
      },
      data: {
        username,
      },
    },
  });
});

app.post("/internal/forms/add-author-to-case", async (c) => {
  const request = await c.req.json();
  const config = await getConfig();
  const values = request.values || request;
  const subreddit = getSubredditKey(request);
  const caseId = normalizeCaseId(values.caseId);
  const username = normalizeUsername(values.username);
  if (!caseId) return c.json({ showToast: "Casefile Guard: enter a case ID like CG-0001." });
  if (!username) return c.json({ showToast: "Casefile Guard: enter a username to link." });

  try {
    await storage.linkUserToCase(redis, {
      subreddit,
      username,
      caseId,
      note: values.note,
      retentionDays: config.retentionDays,
    });
    return c.json({ showToast: `Linked u/${username} to ${caseId}.` });
  } catch (error) {
    console.error("Casefile Guard form link failed", error?.message || error);
    return c.json({ showToast: `Casefile Guard could not link u/${username} to ${caseId}.` });
  }
});

app.post("/internal/settings/validate-account-age", async (c) => {
  const { value } = await c.req.json();
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 365) {
    return c.json({ success: false, error: "Use a number from 0 to 365." });
  }
  return c.json({ success: true });
});

app.post("/internal/settings/validate-phrases", async (c) => {
  const { value } = await c.req.json();
  return c.json(validatePhraseWatchlist(value));
});

app.post("/internal/settings/validate-usernames", async (c) => {
  const { value } = await c.req.json();
  return c.json(validateUsernameWatchlist(value));
});

app.post("/internal/settings/validate-retention", async (c) => {
  const { value } = await c.req.json();
  const number = Number(value);
  if (!Number.isFinite(number) || number < 7 || number > 180) {
    return c.json({ success: false, error: "Use a number from 7 to 180 days." });
  }
  return c.json({ success: true });
});

app.post("/internal/settings/validate-excerpt-length", async (c) => {
  const { value } = await c.req.json();
  const number = Number(value);
  if (!Number.isFinite(number) || number < 80 || number > 500) {
    return c.json({ success: false, error: "Use a number from 80 to 500 characters." });
  }
  return c.json({ success: true });
});

app.post("/internal/scheduler/retention-cleanup", async (c) => {
  const config = await getConfig();
  return c.json({ status: "ok", retentionDays: config.retentionDays });
});

app.post("/internal/triggers/delete", async (c) => {
  // V1 stores short excerpts and IDs for moderation context. Full content deletion
  // hygiene is handled primarily by short TTLs; this endpoint is reserved for
  // future per-item purge when Devvit delete payloads are confirmed in playtest.
  return c.json({ status: "ok" });
});

module.exports = app;
module.exports.default = app;
