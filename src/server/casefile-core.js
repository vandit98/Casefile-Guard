"use strict";

const DEFAULT_SETTINGS = Object.freeze({
  casefileMode: "internal-note",
  autoArchiveConfirmedCases: false,
  muteArchivedConversations: "none",
  phraseWatchlist: "",
  usernameWatchlist: "",
  minimumAccountAgeDays: 3,
  storeMessageExcerpts: true,
  maxExcerptCharacters: 220,
  retentionDays: 30,
});

const COMMAND_RE = /^!case(?:file)?(?:\s+(new|add|link|close|summary|help)\b\s*(.*))?$/i;

function nowIso() {
  return new Date().toISOString();
}

function normalizeUsername(value) {
  if (!value) return "";
  return String(value).trim().replace(/^u\//i, "").replace(/^@/, "").toLowerCase();
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseWatchPhrases(value) {
  return String(value || "")
    .split(/[\n,]/)
    .map((phrase) => normalizeText(phrase))
    .filter(Boolean)
    .filter((phrase, index, all) => all.indexOf(phrase) === index);
}

function parseUsernameWatchlist(value) {
  return String(value || "")
    .split(/[\n,]/)
    .map((username) => normalizeUsername(username))
    .filter(Boolean)
    .filter((username, index, all) => all.indexOf(username) === index);
}

function validatePhraseWatchlist(value) {
  const raw = String(value || "");
  const phrases = parseWatchPhrases(raw);
  if (raw.length > 2000) {
    return { success: false, error: "Keep the phrase watchlist under 2,000 characters." };
  }
  if (phrases.length > 40) {
    return { success: false, error: "Use 40 or fewer watch phrases." };
  }
  if (phrases.some((phrase) => phrase.length < 3 || phrase.length > 80)) {
    return { success: false, error: "Each watch phrase should be 3 to 80 characters after normalization." };
  }
  return { success: true };
}

function validateUsernameWatchlist(value) {
  const raw = String(value || "");
  const usernames = parseUsernameWatchlist(raw);
  if (raw.length > 2000) {
    return { success: false, error: "Keep the username watchlist under 2,000 characters." };
  }
  if (usernames.length > 100) {
    return { success: false, error: "Use 100 or fewer watched usernames." };
  }
  if (usernames.some((username) => !/^[a-z0-9_-]{3,20}$/i.test(username))) {
    return { success: false, error: "Use Reddit usernames only, without spaces or punctuation." };
  }
  return { success: true };
}

function mergeSettings(raw = {}) {
  return {
    ...DEFAULT_SETTINGS,
    ...Object.fromEntries(
      Object.entries(raw).filter(([, value]) => value !== undefined && value !== null && value !== "")
    ),
  };
}

function parseCommand(body) {
  const text = String(body || "").trim();
  const match = text.match(COMMAND_RE);
  if (!match) return /^!case(?:file)?\b/i.test(text) ? { action: "help", invalid: true } : null;

  const [, action, restRaw] = match;
  if (!action) return { action: "help" };
  const rest = String(restRaw || "").trim();
  if (action.toLowerCase() === "add") {
    const [caseId, ...noteParts] = rest.split(/\s+/);
    return { action: "add", caseId: normalizeCaseId(caseId), note: noteParts.join(" ").trim() };
  }

  if (action.toLowerCase() === "new") {
    return { action: "new", label: rest || "Modmail harassment" };
  }

  if (action.toLowerCase() === "link") {
    const [caseId, username, ...noteParts] = rest.split(/\s+/);
    return {
      action: "link",
      caseId: normalizeCaseId(caseId),
      username: normalizeUsername(username),
      note: noteParts.join(" ").trim(),
    };
  }

  if (action.toLowerCase() === "close") {
    const [caseId, ...noteParts] = rest.split(/\s+/);
    return { action: "close", caseId: normalizeCaseId(caseId), note: noteParts.join(" ").trim() };
  }

  if (action.toLowerCase() === "summary") {
    return { action: "summary", caseId: normalizeCaseId(rest) };
  }

  if (action.toLowerCase() === "help") {
    return { action: "help" };
  }

  return null;
}

function classifyModmailMessage(message = {}) {
  const command = parseCommand(message.body);
  if (command) {
    return message.isInternal
      ? { type: "command", command }
      : { type: "ignored", reason: "external command-like message" };
  }
  if (message.isInternal || !message.author) {
    return { type: "ignored", reason: "internal or missing author" };
  }
  return { type: "candidate" };
}

function normalizeCaseId(value) {
  const cleaned = String(value || "").trim().toUpperCase();
  if (!cleaned) return "";
  if (/^CG-\d+$/.test(cleaned)) return cleaned;
  if (/^\d+$/.test(cleaned)) return `CG-${cleaned.padStart(4, "0")}`;
  return cleaned;
}

function getMessageAuthor(message = {}, conversation = {}) {
  return (
    message.author?.name ||
    message.author?.username ||
    message.authorName ||
    message.participant?.name ||
    conversation.participant?.name ||
    conversation.owner?.name ||
    conversation.user?.name ||
    ""
  );
}

function getMessageBody(message = {}) {
  return message.bodyMarkdown || message.body || message.message || message.text || "";
}

function extractTriggeredMessage(conversationResult = {}, triggerEvent = {}) {
  const rawMessageId = String(triggerEvent.messageId || "");
  const messageId = rawMessageId.includes("_") ? rawMessageId.split("_").pop() : rawMessageId;
  const messages = conversationResult.messages || {};
  const message = messages[messageId] || messages[rawMessageId] || newestMessage(messages);
  const conversation = conversationResult.conversation || {};

  return {
    id: rawMessageId || message?.id || messageId || "",
    conversationId: triggerEvent.conversationId || conversation.id || "",
    author: normalizeUsername(getMessageAuthor(message, conversation)),
    body: getMessageBody(message),
    subject: conversation.subject || "",
    createdAt: message?.date || message?.createdAt || triggerEvent.createdAt || nowIso(),
    isInternal: Boolean(message?.isInternal || message?.internal || message?.author?.isMod),
  };
}

function newestMessage(messages) {
  return Object.values(messages || {}).sort((a, b) => {
    return new Date(b?.date || b?.createdAt || 0).getTime() - new Date(a?.date || a?.createdAt || 0).getTime();
  })[0];
}

function accountAgeDays(user = {}, referenceDate = new Date()) {
  const createdAt = user.createdAt || user.created || user.createdUtc || user.createdUTC;
  if (!createdAt) return null;
  const createdMs = typeof createdAt === "number" ? createdAt * (createdAt < 10_000_000_000 ? 1000 : 1) : Date.parse(createdAt);
  if (!Number.isFinite(createdMs)) return null;
  return Math.max(0, Math.floor((new Date(referenceDate).getTime() - createdMs) / 86_400_000));
}

function scoreModmail({ message, user, settings, knownCase }) {
  const config = mergeSettings(settings);
  const body = normalizeText(message?.body);
  const subject = normalizeText(message?.subject);
  const author = normalizeUsername(message?.author);
  const phrases = parseWatchPhrases(config.phraseWatchlist);
  const usernames = parseUsernameWatchlist(config.usernameWatchlist);
  const reasons = [];
  const signals = [];
  let score = 0;

  if (knownCase?.id) {
    score += 6;
    reasons.push(`sender already linked to ${knownCase.id}`);
    signals.push(`user:${author}`);
  }

  for (const phrase of phrases) {
    if (phrase && (containsPhrase(body, phrase) || containsPhrase(subject, phrase))) {
      score += 3;
      reasons.push(`matched watch phrase: "${phrase}"`);
      signals.push(`phrase:${phrase}`);
    }
  }

  if (author && usernames.includes(author)) {
    score += 5;
    reasons.push(`sender is on the casefile username watchlist`);
    signals.push(`user:${author}`);
  }

  const age = accountAgeDays(user);
  const minAge = Number(config.minimumAccountAgeDays || 0);
  if (age !== null && minAge > 0 && age < minAge) {
    score += 1;
    reasons.push(`account younger than ${minAge} days`);
    signals.push(`young-account:<${minAge}`);
  }

  if (body.length > 1500) {
    score += 1;
    reasons.push("very long modmail body");
    signals.push("body:very-long");
  }

  return {
    score,
    reasons,
    signals: [...new Set(signals)],
    shouldCreateCase: score >= 3 && !knownCase?.id,
    shouldAppendToCase: score >= 1 && Boolean(knownCase?.id),
    shouldAutoArchive: Boolean(knownCase?.id && config.autoArchiveConfirmedCases),
  };
}

function containsPhrase(normalizedText, phrase) {
  return ` ${normalizedText} `.includes(` ${normalizeText(phrase)} `);
}

function eventFromMessage(message, extra = {}) {
  const storeExcerpt = extra.storeExcerpt !== false;
  const excerptLength = boundedNumber(extra.excerptLength, 80, 500, 220);
  return {
    id: message.id || extra.id || cryptoSafeId(),
    type: extra.type || "modmail",
    author: normalizeUsername(message.author || extra.author),
    subject: message.subject || "",
    bodyExcerpt: storeExcerpt ? excerpt(message.body, excerptLength) : "(message excerpt disabled by app settings)",
    conversationId: message.conversationId || extra.conversationId || "",
    permalink: extra.permalink || "",
    reasons: extra.reasons || [],
    signals: extra.signals || [],
    retentionDays: extra.retentionDays,
    createdAt: message.createdAt || extra.createdAt || nowIso(),
  };
}

function cryptoSafeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function boundedNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function excerpt(value, length = 240) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= length) return text;
  return `${text.slice(0, Math.max(0, length - 1)).trim()}…`;
}

function buildCaseSummary(caseFile, events = [], options = {}) {
  const sorted = [...events].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const accounts = new Set(sorted.map((event) => normalizeUsername(event.author)).filter(Boolean));
  const header = [
    `**Casefile Guard ${caseFile.id}: ${caseFile.label || "Modmail harassment"}**`,
    `Status: ${caseFile.status || "open"}`,
    `Accounts linked: ${accounts.size ? [...accounts].map((name) => `u/${name}`).join(", ") : "none yet"}`,
    `Events: ${sorted.length}`,
  ];

  const lines = sorted.slice(-Number(options.limit || 10)).map((event) => {
    const when = event.createdAt ? new Date(event.createdAt).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "unknown time";
    const reasons = event.reasons?.length ? ` Reason: ${event.reasons.join("; ")}.` : "";
    const link = event.conversationId ? ` Conversation: ${event.conversationId}.` : "";
    return `- ${when} — u/${event.author || "unknown"}: ${event.bodyExcerpt || "(no body excerpt)"}${reasons}${link}`;
  });

  const footer = [
    "",
    "Suggested next step: review the timeline, then report ban evasion or harassment with the linked accounts and conversations if the pattern is confirmed.",
  ];

  return [...header, "", ...lines, ...footer].join("\n");
}

function buildEscalationPacket(caseFile, events = []) {
  const sorted = [...events].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const accounts = [...new Set(sorted.map((event) => normalizeUsername(event.author)).filter(Boolean))];
  const conversationIds = [...new Set(sorted.map((event) => event.conversationId).filter(Boolean))];
  return [
    `Case: ${caseFile.id} - ${caseFile.label || "Modmail harassment"}`,
    `Observed pattern: repeat modmail harassment / possible ban or mute evasion.`,
    `Accounts: ${accounts.map((name) => `u/${name}`).join(", ") || "unknown"}`,
    `Conversation IDs: ${conversationIds.join(", ") || "none recorded"}`,
    "",
    "Timeline:",
    ...sorted.map((event) => `- ${event.createdAt}: u/${event.author || "unknown"} — ${event.bodyExcerpt || "(no excerpt)"}`),
  ].join("\n");
}

function buildCommandHelp() {
  return [
    "**Casefile Guard commands**",
    "",
    "- `!case new <label>` creates a new casefile from this conversation.",
    "- `!case add <case id> <note>` adds this conversation to an existing casefile.",
    "- `!case link <case id> <username> <note>` links a username to a casefile.",
    "- `!case summary <case id>` posts an escalation packet.",
    "- `!case close <case id> <note>` closes a casefile.",
  ].join("\n");
}

module.exports = {
  DEFAULT_SETTINGS,
  accountAgeDays,
  buildCommandHelp,
  buildCaseSummary,
  buildEscalationPacket,
  classifyModmailMessage,
  eventFromMessage,
  excerpt,
  extractTriggeredMessage,
  mergeSettings,
  normalizeCaseId,
  normalizeText,
  normalizeUsername,
  parseCommand,
  parseWatchPhrases,
  parseUsernameWatchlist,
  scoreModmail,
  validatePhraseWatchlist,
  validateUsernameWatchlist,
};
