import { test } from "node:test";
import assert from "node:assert/strict";
import {
  askGoaly,
  createGoalyFinalConfirmation,
  isGoalyDraftReadyToCreate,
  sanitizeGoalyBuilderReply,
} from "../app/lib/goaly.ts";
test("Goaly uses the local chat proxy even while challenge mocks are enabled", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async (url: RequestInfo | URL, init?: RequestInit) => {
      assert.equal(url, "/qvac/chat");
      assert.deepEqual(JSON.parse(String(init?.body)), {
        messages: [{ role: "user", content: "Wake up at 7" }],
      });
      return Response.json({ answer: "Which timezone?" });
    },
  );
  assert.deepEqual(
    await askGoaly([{ role: "user", content: "Wake up at 7" }]),
    { answer: "Which timezone?" },
  );
});
test("Goaly rejects oversized requests and shows upstream errors without a fake reply", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return Response.json({ error: "QVAC is unavailable." }, { status: 503 });
  });
  await assert.rejects(askGoaly([{ role: "user", content: "x".repeat(501) }]));
  assert.equal(calls, 0);
  await assert.rejects(askGoaly([{ role: "user", content: "Hello" }]), /QVAC is unavailable/);
});

test("Goaly explains an empty proxy response instead of exposing a JSON parse error", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 502 }));
  await assert.rejects(askGoaly([{ role: "user", content: "Help me make a goal" }]), /invalid response.*port 4000/i);
});

test("Goaly sends recent conversation context so the local model can avoid repeating questions", async (t) => {
  const messages = [
    { role: "user" as const, content: "I will earn lottery at 22:10 UTC." },
    { role: "assistant" as const, content: "What is your stake and deadline?" },
    { role: "user" as const, content: "5 USDT; deadline in 5 minutes." },
  ];
  t.mock.method(globalThis, "fetch", async (_url: RequestInfo | URL, init?: RequestInit) => {
    assert.deepEqual(JSON.parse(String(init?.body)), { messages });
    return Response.json({ answer: "The success rule is still unclear." });
  });
  assert.deepEqual(await askGoaly(messages), { answer: "The success rule is still unclear." });
});

test("Goaly uses the structured builder endpoint and returns its reviewable draft", async (t) => {
  const draft = {
    title: "Lottery draw",
    successRule: "Ticket matches a winning number in the named draw.",
    proofSource: "Official lottery results",
    stake: "5.00",
    deadline: "2026-10-20T18:00",
    visibility: "public" as const,
  };
  t.mock.method(globalThis, "fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(url, "/qvac/builder");
    assert.deepEqual(JSON.parse(String(init?.body)), {
      messages: [{ role: "user", content: "Build a lottery challenge" }],
      draft,
    });
    return Response.json({ answer: "Review the proposed draft.", readyToCreate: true, draft });
  });
  assert.deepEqual(
    await askGoaly([{ role: "user", content: "Build a lottery challenge" }], draft),
    { answer: "Review the proposed draft.", readyToCreate: true, draft },
  );
});

test("a plain-language proof reply completes the source instead of asking for a URL or timezone", async (t) => {
  const draft = {
    title: "Seven-day reading goal",
    successRule: "Read for 30 minutes each day for seven days.",
    proofSource: "Daily reading log",
    stake: "1",
    deadline: "2099-12-31T18:00",
    visibility: "public" as const,
  };
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      answer: "I still need the exact URL for your proof submission and specific timezone.",
      readyToCreate: false,
      draft,
    }),
  );
  const reply = await askGoaly([
    { role: "user", content: "The deadline is 2099-12-31 18:00 my local time; I will submit a daily log." },
    { role: "assistant", content: "Please provide the exact URL and timezone." },
    { role: "user", content: "My notes and dated reading log, with 20:00 entries" },
  ], draft);

  assert.equal(reply.readyToCreate, true);
  assert.equal(reply.draft?.proofSource, "My notes and dated reading log, with 20:00 entries");
  assert.match(reply.answer, /proof source.*recorded/i);
  assert.doesNotMatch(reply.answer, /provide.*url|specific timezone/i);
});

test("a plain-language proof source is accepted while other details are incomplete", async (t) => {
  const draft = {
    title: "Reading goal",
    successRule: "Read each day.",
    proofSource: "",
    stake: "",
    deadline: "",
    visibility: "public" as const,
  };
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      answer: "Please provide a URL and timezone.",
      readyToCreate: false,
      draft,
    }),
  );
  const reply = await askGoaly([
    { role: "assistant", content: "What proof will you provide? Please send a URL." },
    { role: "user", content: "I will share a photo" },
  ], draft);

  assert.equal(reply.readyToCreate, false);
  assert.equal(reply.draft?.proofSource, "I will share a photo");
  assert.match(reply.answer, /proof source.*recorded/i);
  assert.doesNotMatch(reply.answer, /provide.*url|specific timezone/i);
});

test("Goaly converts a stake with a USDT label to the numeric form value", async (t) => {
  const draft = {
    title: "Reading challenge",
    successRule: "Read 30 minutes per day for seven days.",
    proofSource: "Daily reading log.",
    stake: "5.00",
    deadline: "2099-12-31T18:00",
    visibility: "public" as const,
  };
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      answer: "Confirm this summary.",
      readyToCreate: false,
      draft: { ...draft, stake: "1 USDT" },
    }),
  );
  const reply = await askGoaly(
    [{ role: "user", content: "Stake: 1 USDT" }],
    draft,
  );
  assert.equal(reply.draft?.stake, "1");
});

test("Goaly keeps older builder responses usable but never marks them ready to create", async (t) => {
  const draft = {
    title: "Pilot reflection",
    successRule: "Submit a reflection.",
    proofSource: "Reflection text pasted into the app.",
    stake: "1.00",
    deadline: "2099-12-31T18:00",
    visibility: "public" as const,
  };
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ answer: "Review this draft.", draft }),
  );
  assert.deepEqual(
    await askGoaly([{ role: "user", content: "Build a challenge" }], draft),
    { answer: "Review this draft.", readyToCreate: false, draft },
  );
});

test("Goaly can create only a confirmed, valid draft that still matches the visible form", () => {
  const draft = {
    title: "Pilot reflection",
    successRule: "Submit at least 150 words and one next step.",
    proofSource: "Reflection text pasted into the app.",
    stake: "1.00",
    deadline: "2099-12-31T18:00",
    visibility: "public" as const,
  };

  assert.equal(isGoalyDraftReadyToCreate(false, draft, draft, 1_800_000_000_000), false);
  assert.equal(isGoalyDraftReadyToCreate(true, draft, { ...draft, stake: "5.00" }, 1_800_000_000_000), false);
  assert.equal(isGoalyDraftReadyToCreate(true, { ...draft, proofSource: "" }, draft, 1_800_000_000_000), false);
  assert.equal(isGoalyDraftReadyToCreate(true, draft, draft, 1_800_000_000_000), true);
});

test("final confirmation displays exact validated draft values without trusting model wording", () => {
  const draft = {
    title: "Seven-day reading goal",
    successRule: "Read for 30 minutes each day.",
    proofSource: "Daily log with the date and minutes read.",
    stake: "1",
    deadline: "2026-10-25T20:00",
    visibility: "public" as const,
  };
  assert.equal(
    createGoalyFinalConfirmation(draft),
    "Review the challenge details:\nTitle: Seven-day reading goal\nSuccess rule: Read for 30 minutes each day.\nProof: Daily log with the date and minutes read.\nStake: 1 USDT\nDeadline: 2026-10-25T20:00 (your browser's local time)\nVisibility: Public\nIf everything is correct, select Create goal below. KaleidoSwap will ask you to approve the deposit.",
  );
  assert.match(
    createGoalyFinalConfirmation({ ...draft, proofSource: "Photo" }),
    /attach your photo with the proof submission/i,
  );
});

test("Goaly draft replies cannot claim creation or change the form deadline", () => {
  const draft = {
    title: "Seven-day reading goal",
    successRule: "Read for 30 minutes each day.",
    proofSource: "Daily reading log.",
    stake: "1",
    deadline: "2026-10-25T20:00",
    visibility: "public" as const,
  };
  assert.match(
    sanitizeGoalyBuilderReply("Challenge created successfully.", draft),
    /has not been created/i,
  );
  assert.match(
    sanitizeGoalyBuilderReply("I set the deadline to 2026-10-25T22:00 local time.", draft),
    /2026-10-25T20:00/,
  );
});
