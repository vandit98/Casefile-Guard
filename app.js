const scenes = [
  {
    title: "Incoming ban appeal",
    status: "Case created",
    archive: "Off",
    messages: [
      {
        author: "u/burner_alpha",
        time: "10:04 UTC",
        text: "You mods are useless. Same threat phrase from the last appeal.",
      },
      {
        author: "Casefile Guard",
        time: "internal note",
        text: "Created CG-0001 after matching watch phrase: \"same threat phrase\".",
        internal: true,
      },
    ],
    accounts: ["burner_alpha"],
    events: [
      {
        title: "10:04 UTC - u/burner_alpha",
        text: "Matched watch phrase and created a mod-only timeline.",
      },
    ],
    note: [
      "Casefile Guard CG-0001: Modmail harassment / possible evasion",
      "Status: open",
      "Accounts linked: u/burner_alpha",
      "Events: 1",
      "",
      "- 10:04 UTC - u/burner_alpha: matched watch phrase. Conversation: conv-a12.",
      "",
      "Suggested next step: review the timeline before taking action.",
    ].join("\n"),
  },
  {
    title: "Same phrase, new account",
    status: "Evidence grouped",
    archive: "Off",
    messages: [
      {
        author: "u/burner_alpha",
        time: "10:04 UTC",
        text: "You mods are useless. Same threat phrase from the last appeal.",
      },
      {
        author: "u/burner_beta",
        time: "10:11 UTC",
        text: "Different account, same threat phrase, same argument.",
      },
      {
        author: "Casefile Guard",
        time: "internal note",
        text: "Appended to CG-0001 by durable phrase signal. Sender is not auto-confirmed.",
        internal: true,
      },
    ],
    accounts: ["burner_alpha", "burner_beta"],
    events: [
      {
        title: "10:04 UTC - u/burner_alpha",
        text: "Initial watch phrase match.",
      },
      {
        title: "10:11 UTC - u/burner_beta",
        text: "Same configured phrase. Grouped as evidence, not automatic enforcement.",
      },
    ],
    note: [
      "Casefile Guard CG-0001: Modmail harassment / possible evasion",
      "Status: open",
      "Accounts linked: u/burner_alpha, u/burner_beta",
      "Events: 2",
      "",
      "- 10:04 UTC - u/burner_alpha: matched watch phrase. Conversation: conv-a12.",
      "- 10:11 UTC - u/burner_beta: matched existing case signal. Conversation: conv-b44.",
    ].join("\n"),
  },
  {
    title: "Moderator confirms link",
    status: "Sender linked",
    archive: "Available after opt-in",
    messages: [
      {
        author: "Mod command",
        time: "10:14 UTC",
        text: "!case link CG-0001 burner_gamma same person, confirmed by appeal context",
        internal: true,
      },
      {
        author: "u/burner_gamma",
        time: "10:18 UTC",
        text: "Another appeal from the same confirmed sender.",
      },
      {
        author: "Casefile Guard",
        time: "internal note",
        text: "Linked u/burner_gamma to CG-0001. Future modmail from this sender can be archived if mods enable it.",
        internal: true,
      },
    ],
    accounts: ["burner_alpha", "burner_beta", "burner_gamma"],
    events: [
      {
        title: "10:04 UTC - u/burner_alpha",
        text: "Initial watch phrase match.",
      },
      {
        title: "10:11 UTC - u/burner_beta",
        text: "Grouped by phrase signal.",
      },
      {
        title: "10:14 UTC - u/burner_gamma",
        text: "Moderator-confirmed link from internal modmail command.",
      },
    ],
    note: [
      "Casefile Guard CG-0001: Modmail harassment / possible evasion",
      "Status: open",
      "Accounts linked: u/burner_alpha, u/burner_beta, u/burner_gamma",
      "Events: 3",
      "",
      "- Manual link: u/burner_gamma. Note: same person, confirmed by appeal context.",
    ].join("\n"),
  },
  {
    title: "Escalation packet ready",
    status: "Summary generated",
    archive: "Opt-in only",
    messages: [
      {
        author: "Mod command",
        time: "10:22 UTC",
        text: "!case summary CG-0001",
        internal: true,
      },
      {
        author: "Casefile Guard",
        time: "internal note",
        text: "Generated an escalation packet with accounts, timestamps, and conversation IDs.",
        internal: true,
      },
    ],
    accounts: ["burner_alpha", "burner_beta", "burner_gamma"],
    events: [
      {
        title: "10:04 UTC - u/burner_alpha",
        text: "Conversation conv-a12.",
      },
      {
        title: "10:11 UTC - u/burner_beta",
        text: "Conversation conv-b44.",
      },
      {
        title: "10:14 UTC - u/burner_gamma",
        text: "Manual moderator link.",
      },
      {
        title: "10:22 UTC - summary",
        text: "Escalation packet ready to review.",
      },
    ],
    note: [
      "Case: CG-0001 - Modmail harassment / possible evasion",
      "Observed pattern: repeat modmail harassment / possible ban or mute evasion.",
      "Accounts: u/burner_alpha, u/burner_beta, u/burner_gamma",
      "Conversation IDs: conv-a12, conv-b44, conv-c31",
      "",
      "Timeline:",
      "- 10:04 UTC: u/burner_alpha - first watch phrase match",
      "- 10:11 UTC: u/burner_beta - same phrase, grouped for review",
      "- 10:14 UTC: u/burner_gamma - moderator-confirmed linked sender",
    ].join("\n"),
  },
];

const state = {
  step: 0,
};

const els = {
  buttons: [...document.querySelectorAll(".action")],
  sceneTitle: document.querySelector("#sceneTitle"),
  statusPill: document.querySelector("#statusPill"),
  archiveState: document.querySelector("#archiveState"),
  messageCount: document.querySelector("#messageCount"),
  thread: document.querySelector("#thread"),
  accounts: document.querySelector("#accounts"),
  timeline: document.querySelector("#timeline"),
  eventCount: document.querySelector("#eventCount"),
  note: document.querySelector("#note"),
};

function render() {
  const scene = scenes[state.step];
  els.sceneTitle.textContent = scene.title;
  els.statusPill.textContent = scene.status;
  els.archiveState.textContent = scene.archive;
  els.messageCount.textContent = `${scene.messages.length} messages`;
  els.eventCount.textContent = `${scene.events.length} events`;
  els.note.textContent = scene.note;

  els.thread.replaceChildren(...scene.messages.map(renderMessage));
  els.accounts.replaceChildren(...scene.accounts.map(renderAccount));
  els.timeline.replaceChildren(...scene.events.map(renderEvent));

  for (const button of els.buttons) {
    button.classList.toggle("active", Number(button.dataset.step) === state.step);
  }
}

function renderMessage(message) {
  const article = document.createElement("article");
  article.className = `message${message.internal ? " internal" : ""}`;
  article.innerHTML = `
    <div class="message-head">
      <strong></strong>
      <span></span>
    </div>
    <p></p>
  `;
  article.querySelector("strong").textContent = message.author;
  article.querySelector("span").textContent = message.time;
  article.querySelector("p").textContent = message.text;
  return article;
}

function renderAccount(name) {
  const chip = document.createElement("span");
  chip.className = "account-chip";
  chip.textContent = `u/${name}`;
  return chip;
}

function renderEvent(event) {
  const row = document.createElement("div");
  row.className = "event";
  row.innerHTML = `
    <span class="dot"></span>
    <div>
      <strong></strong>
      <p></p>
    </div>
  `;
  row.querySelector("strong").textContent = event.title;
  row.querySelector("p").textContent = event.text;
  return row;
}

for (const button of els.buttons) {
  button.addEventListener("click", () => {
    state.step = Number(button.dataset.step);
    render();
  });
}

window.addEventListener("keydown", (event) => {
  const digit = Number(event.key);
  if (digit >= 1 && digit <= scenes.length) {
    state.step = digit - 1;
    render();
  }
});

render();
