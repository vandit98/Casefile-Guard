import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { FakeRedis } from "./helpers/fake-redis.mjs";

const require = createRequire(import.meta.url);
const storage = require("../src/server/storage.js");

test("storage indexes users and durable phrase signals without storing retention metadata", async () => {
  const redis = new FakeRedis();
  const caseFile = await storage.createCase(redis, {
    subreddit: "t5_casefile",
    label: "repeat abuse",
    createdBy: "casefile-guard",
    seedEvent: {
      id: "m-1",
      author: "Burner_One",
      bodyExcerpt: "go away",
      conversationId: "conv-1",
      reasons: ["matched watch phrase"],
      signals: ["phrase:go kys", "young-account:<3"],
      retentionDays: 45,
      createdAt: "2026-05-01T00:00:00.000Z",
    },
  });

  const byUser = await storage.findOpenCaseForUser(redis, "t5_casefile", "u/Burner_One");
  assert.equal(byUser.id, caseFile.id);

  const bySignal = await storage.findOpenCaseForSignals(redis, "t5_casefile", [
    "young-account:<3",
    "phrase:go kys",
  ]);
  assert.equal(bySignal.caseFile.id, caseFile.id);
  assert.equal(bySignal.signal, "phrase:go kys");

  const events = await storage.listCaseEvents(redis, caseFile.id);
  assert.equal(events.length, 1);
  assert.equal(events[0].retentionDays, undefined);
  assert.ok([...redis.expirations.values()].includes(45 * 86_400));
});

test("closed cases are not returned through user or signal indexes", async () => {
  const redis = new FakeRedis();
  const caseFile = await storage.createCase(redis, {
    subreddit: "t5_casefile",
    seedEvent: {
      id: "m-1",
      author: "burner_two",
      signals: ["phrase:same script"],
      createdAt: "2026-05-01T00:00:00.000Z",
    },
  });

  await storage.closeCase(redis, caseFile.id, "resolved");

  assert.equal(await storage.findOpenCaseForUser(redis, "t5_casefile", "burner_two"), null);
  assert.equal(await storage.findOpenCaseForSignals(redis, "t5_casefile", ["phrase:same script"]), null);
});

test("manual links use the stored case subreddit when form context is absent", async () => {
  const redis = new FakeRedis();
  const caseFile = await storage.createCase(redis, {
    subreddit: "t5_real_subreddit",
    seedEvent: {
      id: "m-1",
      author: "first_sender",
      createdAt: "2026-05-01T00:00:00.000Z",
    },
  });

  await storage.linkUserToCase(redis, {
    subreddit: "unknown",
    username: "Manual_Link",
    caseId: caseFile.id,
    note: "same person",
    retentionDays: 30,
  });

  const linked = await storage.findOpenCaseForUser(redis, "t5_real_subreddit", "manual_link");
  assert.equal(linked.id, caseFile.id);
  assert.equal(await storage.findOpenCaseForUser(redis, "unknown", "manual_link"), null);
});

test("listCaseEvents returns the latest events in chronological order", async () => {
  const redis = new FakeRedis();
  const caseFile = await storage.createCase(redis, {
    subreddit: "t5_casefile",
    seedEvent: {
      id: "m-1",
      author: "one",
      createdAt: "2026-05-01T00:00:00.000Z",
    },
  });

  await storage.appendEvent(redis, caseFile.id, {
    id: "m-2",
    author: "two",
    createdAt: "2026-05-01T00:01:00.000Z",
  });
  await storage.appendEvent(redis, caseFile.id, {
    id: "m-3",
    author: "three",
    createdAt: "2026-05-01T00:02:00.000Z",
  });

  const events = await storage.listCaseEvents(redis, caseFile.id, 2);
  assert.deepEqual(events.map((event) => event.id), ["m-2", "m-3"]);
});
