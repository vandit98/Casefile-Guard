import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { FakeRedis } from "./helpers/fake-redis.mjs";

const require = createRequire(import.meta.url);
const storage = require("../src/server/storage.js");

test("case timelines stay bounded and recover the latest events after a burst", async () => {
  const redis = new FakeRedis();
  const caseFile = await storage.createCase(redis, {
    subreddit: "t5_burst",
    seedEvent: {
      id: "m-000",
      author: "burner_000",
      signals: ["phrase:same script"],
      createdAt: "2026-05-01T00:00:00.000Z",
    },
  });

  for (let index = 1; index <= 200; index += 1) {
    await storage.appendEvent(redis, caseFile.id, {
      id: `m-${String(index).padStart(3, "0")}`,
      author: `burner_${String(index).padStart(3, "0")}`,
      signals: ["phrase:same script"],
      createdAt: new Date(Date.UTC(2026, 4, 1, 0, index, 0)).toISOString(),
    });
  }

  const latest = await storage.listCaseEvents(redis, caseFile.id, 25);
  assert.equal(latest.length, 25);
  assert.equal(latest[0].id, "m-176");
  assert.equal(latest.at(-1).id, "m-200");

  const signalMatch = await storage.findOpenCaseForSignals(redis, "t5_burst", ["phrase:same script"]);
  assert.equal(signalMatch.caseFile.id, caseFile.id);
});
