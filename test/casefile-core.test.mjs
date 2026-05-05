import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const core = require("../src/server/casefile-core.js");

test("parseCommand handles core modmail commands", () => {
  assert.deepEqual(core.parseCommand("!case new repeated slur wave"), {
    action: "new",
    label: "repeated slur wave",
  });
  assert.deepEqual(core.parseCommand("!case add 12 same person, new burner"), {
    action: "add",
    caseId: "CG-0012",
    note: "same person, new burner",
  });
  assert.deepEqual(core.parseCommand("!case close CG-0007 resolved"), {
    action: "close",
    caseId: "CG-0007",
    note: "resolved",
  });
  assert.deepEqual(core.parseCommand("!case link 7 u/Burner_Three same person"), {
    action: "link",
    caseId: "CG-0007",
    username: "burner_three",
    note: "same person",
  });
  assert.deepEqual(core.parseCommand("!case"), { action: "help" });
  assert.deepEqual(core.parseCommand("!case wat"), { action: "help", invalid: true });
});

test("watch phrases normalize mixed punctuation and unicode spacing", () => {
  assert.deepEqual(core.parseWatchPhrases("Go KYS,\n k\u200by\u200bs "), ["go kys", "kys"]);
});

test("watchlist validators catch unsafe install settings", () => {
  assert.deepEqual(core.validatePhraseWatchlist("go kys, same script"), { success: true });
  assert.equal(core.validatePhraseWatchlist("x").success, false);
  assert.deepEqual(core.validateUsernameWatchlist("u/Some_User, other-user"), { success: true });
  assert.equal(core.validateUsernameWatchlist("bad user").success, false);
});

test("classifyModmailMessage runs only internal case commands", () => {
  assert.equal(core.classifyModmailMessage({ body: "!case help", isInternal: true }).type, "command");
  assert.deepEqual(core.classifyModmailMessage({ body: "!case help", isInternal: false, author: "user" }), {
    type: "ignored",
    reason: "external command-like message",
  });
  assert.deepEqual(core.classifyModmailMessage({ body: "regular internal note", isInternal: true, author: "mod" }), {
    type: "ignored",
    reason: "internal or missing author",
  });
  assert.deepEqual(core.classifyModmailMessage({ body: "regular appeal", isInternal: false, author: "user" }), {
    type: "candidate",
  });
});

test("scoreModmail creates cases for configured phrase matches", () => {
  const result = core.scoreModmail({
    message: {
      body: "You mods are useless, go KYS",
      subject: "ban appeal",
    },
    settings: {
      phraseWatchlist: "go kys",
      minimumAccountAgeDays: 0,
    },
  });
  assert.equal(result.score, 3);
  assert.equal(result.shouldCreateCase, true);
  assert.equal(result.shouldAutoArchive, false);
  assert.deepEqual(result.signals, ["phrase:go kys"]);
});

test("watch phrases match normalized word boundaries instead of substrings", () => {
  const result = core.scoreModmail({
    message: {
      body: "This appeal is classy but not abusive",
      subject: "",
    },
    settings: {
      phraseWatchlist: "ass",
      minimumAccountAgeDays: 0,
    },
  });

  assert.equal(result.score, 0);
  assert.equal(result.shouldCreateCase, false);
});

test("scoreModmail produces durable username watchlist signals", () => {
  const result = core.scoreModmail({
    message: {
      author: "Known_Burner",
      body: "hello mods",
    },
    settings: {
      usernameWatchlist: "known_burner, other_user",
      minimumAccountAgeDays: 0,
    },
  });
  assert.equal(result.score, 5);
  assert.equal(result.shouldCreateCase, true);
  assert.deepEqual(result.signals, ["user:known_burner"]);
});

test("extractTriggeredMessage selects the message from Devvit modmail trigger IDs", () => {
  const message = core.extractTriggeredMessage(
    {
      conversation: {
        id: "conv-1",
        subject: "Appeal",
      },
      messages: {
        abc: {
          author: { name: "Burner_One" },
          bodyMarkdown: "same harassment phrase",
          createdAt: "2026-05-01T00:00:00.000Z",
        },
      },
    },
    {
      conversationId: "conv-1",
      messageId: "ModMailMessage_abc",
    }
  );

  assert.equal(message.conversationId, "conv-1");
  assert.equal(message.author, "burner_one");
  assert.equal(message.body, "same harassment phrase");
  assert.equal(message.subject, "Appeal");
});

test("accountAgeDays handles second-based Reddit timestamps", () => {
  const age = core.accountAgeDays(
    { createdUtc: 1_777_593_600 },
    new Date("2026-05-02T00:00:00.000Z")
  );
  assert.equal(age, 1);
});

test("eventFromMessage honors privacy and bounded excerpt settings", () => {
  const event = core.eventFromMessage(
    {
      id: "m-1",
      author: "Burner_One",
      body: "x".repeat(300),
      conversationId: "conv-1",
      createdAt: "2026-05-01T00:00:00.000Z",
    },
    {
      storeExcerpt: true,
      excerptLength: 120,
      retentionDays: 45,
    }
  );

  assert.equal(event.author, "burner_one");
  assert.equal(event.bodyExcerpt.length, 120);
  assert.equal(event.retentionDays, 45);

  const hidden = core.eventFromMessage({ body: "do not store this" }, { storeExcerpt: false });
  assert.equal(hidden.bodyExcerpt, "(message excerpt disabled by app settings)");
});

test("scoreModmail appends and auto-archives only known confirmed senders", () => {
  const result = core.scoreModmail({
    message: { author: "Burner_One", body: "new burner here" },
    knownCase: { id: "CG-0003" },
    settings: {
      autoArchiveConfirmedCases: true,
    },
  });
  assert.equal(result.shouldAppendToCase, true);
  assert.equal(result.shouldCreateCase, false);
  assert.equal(result.shouldAutoArchive, true);
  assert.deepEqual(result.signals, ["user:burner_one"]);
});

test("buildCaseSummary produces a compact moderator-readable timeline", () => {
  const summary = core.buildCaseSummary(
    { id: "CG-0001", label: "Modmail harassment", status: "open" },
    [
      {
        author: "burner_one",
        bodyExcerpt: "first message",
        conversationId: "abc",
        reasons: ["matched watch phrase"],
        createdAt: "2026-05-01T00:00:00.000Z",
      },
      {
        author: "burner_two",
        bodyExcerpt: "second message",
        conversationId: "def",
        reasons: [],
        createdAt: "2026-05-01T00:05:00.000Z",
      },
    ]
  );

  assert.match(summary, /Casefile Guard CG-0001/);
  assert.match(summary, /Accounts linked: u\/burner_one, u\/burner_two/);
  assert.match(summary, /matched watch phrase/);
});

test("buildCommandHelp names every supported modmail command", () => {
  const help = core.buildCommandHelp();
  assert.match(help, /!case new/);
  assert.match(help, /!case add/);
  assert.match(help, /!case link/);
  assert.match(help, /!case summary/);
  assert.match(help, /!case close/);
});
