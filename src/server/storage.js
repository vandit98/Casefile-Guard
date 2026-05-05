"use strict";

const { normalizeUsername } = require("./casefile-core");

const PREFIX = "cg";

function caseKey(id) {
  return `${PREFIX}:case:${id}`;
}

function caseEventsKey(id) {
  return `${PREFIX}:case:${id}:events`;
}

function caseAccountsKey(id) {
  return `${PREFIX}:case:${id}:accounts`;
}

function subredditSeqKey(subreddit) {
  return `${PREFIX}:${subreddit}:caseSeq`;
}

function openCasesKey(subreddit) {
  return `${PREFIX}:${subreddit}:open`;
}

function userIndexKey(subreddit, username) {
  return `${PREFIX}:${subreddit}:user:${normalizeUsername(username)}`;
}

function signalIndexKey(subreddit, signal) {
  return `${PREFIX}:${subreddit}:signal:${encodeSignal(signal)}`;
}

function encodeSignal(signal) {
  return String(signal || "")
    .toLowerCase()
    .replace(/[^a-z0-9:_<.-]+/g, "-")
    .slice(0, 180);
}

function toRedisStringMap(value) {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, item === undefined || item === null ? "" : String(item)])
  );
}

function retentionSeconds(days) {
  const safeDays = Math.min(180, Math.max(7, Number(days || 30)));
  return safeDays * 86_400;
}

async function createCase(redis, { subreddit, label, createdBy, seedEvent }) {
  const seq = await redis.incrBy(subredditSeqKey(subreddit), 1);
  const id = `CG-${String(seq).padStart(4, "0")}`;
  const now = new Date().toISOString();
  const caseFile = {
    id,
    subreddit,
    label: label || "Modmail harassment",
    status: "open",
    createdBy: createdBy || "casefile-guard",
    createdAt: now,
    updatedAt: now,
  };

  await redis.hSet(caseKey(id), toRedisStringMap(caseFile));
  await redis.zAdd(openCasesKey(subreddit), { member: id, score: Date.now() });
  if (seedEvent) await appendEvent(redis, id, seedEvent);
  return caseFile;
}

async function getCase(redis, id) {
  if (!id) return null;
  const caseFile = await redis.hGetAll(caseKey(id));
  if (!caseFile || !caseFile.id) return null;
  return caseFile;
}

async function closeCase(redis, id, note) {
  const caseFile = await getCase(redis, id);
  if (!caseFile) return null;
  const updatedAt = new Date().toISOString();
  await redis.hSet(caseKey(id), toRedisStringMap({ ...caseFile, status: "closed", closeNote: note || "", updatedAt }));
  await redis.zRem(openCasesKey(caseFile.subreddit), [id]);
  return { ...caseFile, status: "closed", closeNote: note || "", updatedAt };
}

async function appendEvent(redis, id, event) {
  const caseFile = await getCase(redis, id);
  if (!caseFile) throw new Error(`Casefile not found: ${id}`);

  const timestamp = Date.parse(event.createdAt || new Date().toISOString()) || Date.now();
  const { retentionDays, ...storedEvent } = event;
  const eventRecord = { ...storedEvent, caseId: id };
  const ttl = retentionSeconds(retentionDays);
  await redis.zAdd(caseEventsKey(id), { member: JSON.stringify(eventRecord), score: timestamp });
  await redis.hSet(caseKey(id), toRedisStringMap({ ...caseFile, updatedAt: new Date().toISOString() }));
  await redis.zAdd(openCasesKey(caseFile.subreddit), { member: id, score: Date.now() });
  await applyRetention(redis, { id, subreddit: caseFile.subreddit }, retentionDays);
  await redis.expire(openCasesKey(caseFile.subreddit), ttl);

  if (event.author) {
    const username = normalizeUsername(event.author);
    await redis.hSet(caseAccountsKey(id), { [username]: String(timestamp) });
    await redis.hSet(userIndexKey(caseFile.subreddit, username), { caseId: id, updatedAt: new Date().toISOString() });
    await redis.expire(userIndexKey(caseFile.subreddit, username), ttl);
  }

  for (const signal of event.signals || []) {
    if (isDurableSignal(signal)) {
      await linkSignalToCase(redis, {
        subreddit: caseFile.subreddit,
        signal,
        caseId: id,
        retentionDays,
      });
    }
  }

  return eventRecord;
}

function isDurableSignal(signal) {
  return /^phrase:|^user:/.test(String(signal || ""));
}

async function linkUserToCase(redis, { subreddit, username, caseId, note, retentionDays }) {
  const normalized = normalizeUsername(username);
  const caseFile = await getCase(redis, caseId);
  if (!caseFile) throw new Error(`Casefile not found: ${caseId}`);
  const targetSubreddit = caseFile.subreddit || subreddit;
  const event = {
    id: `manual-${Date.now()}`,
    type: "manual-link",
    author: normalized,
    subject: "Manual author link",
    bodyExcerpt: note || "Linked by moderator menu action.",
    conversationId: "",
    reasons: ["manual moderator link"],
    retentionDays,
    createdAt: new Date().toISOString(),
  };
  await appendEvent(redis, caseId, event);
  await redis.hSet(userIndexKey(targetSubreddit, normalized), { caseId, updatedAt: new Date().toISOString() });
  await redis.expire(userIndexKey(targetSubreddit, normalized), retentionSeconds(retentionDays));
  return event;
}

async function findOpenCaseForUser(redis, subreddit, username) {
  const normalized = normalizeUsername(username);
  if (!normalized) return null;
  const index = await redis.hGetAll(userIndexKey(subreddit, normalized));
  if (!index?.caseId) return null;
  const caseFile = await getCase(redis, index.caseId);
  if (!caseFile || caseFile.status !== "open") return null;
  return caseFile;
}

async function findOpenCaseForSignals(redis, subreddit, signals = []) {
  for (const signal of signals.filter(isDurableSignal)) {
    const index = await redis.hGetAll(signalIndexKey(subreddit, signal));
    if (!index?.caseId) continue;
    const caseFile = await getCase(redis, index.caseId);
    if (caseFile && caseFile.status === "open") {
      return { caseFile, signal };
    }
  }
  return null;
}

async function linkSignalToCase(redis, { subreddit, signal, caseId, retentionDays }) {
  await redis.hSet(signalIndexKey(subreddit, signal), {
    caseId,
    signal,
    updatedAt: new Date().toISOString(),
  });
  await redis.expire(signalIndexKey(subreddit, signal), retentionSeconds(retentionDays));
}

async function listOpenCases(redis, subreddit, limit = 10) {
  const rows = await redis.zRange(openCasesKey(subreddit), 0, limit - 1, { by: "rank", reverse: true });
  const ids = (rows || []).map(zMember).filter(Boolean);
  const cases = [];
  for (const id of ids || []) {
    const caseFile = await getCase(redis, id);
    if (caseFile && caseFile.status === "open") cases.push(caseFile);
  }
  return cases;
}

async function listCaseEvents(redis, id, limit = 25) {
  const rows = await redis.zRange(caseEventsKey(id), 0, limit - 1, { by: "rank", reverse: true });
  const raw = (rows || []).map(zMember).filter(Boolean).reverse();
  return (raw || [])
    .map((value) => {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function zMember(row) {
  if (typeof row === "string") return row;
  return row?.member || "";
}

async function applyRetention(redis, caseFile, retentionDays) {
  const seconds = retentionSeconds(retentionDays);
  await redis.expire(caseKey(caseFile.id), seconds);
  await redis.expire(caseEventsKey(caseFile.id), seconds);
  await redis.expire(caseAccountsKey(caseFile.id), seconds);
}

module.exports = {
  appendEvent,
  applyRetention,
  closeCase,
  createCase,
  findOpenCaseForSignals,
  findOpenCaseForUser,
  getCase,
  linkSignalToCase,
  linkUserToCase,
  listCaseEvents,
  listOpenCases,
};
