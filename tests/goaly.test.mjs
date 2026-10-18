import { test } from "node:test";
import assert from "node:assert/strict";
import { goalyMessages } from "../qvac/goaly.mjs";
import { goalyBuilderFormat, goalyBuilderMessages, parseGoalyBuilderAnswer } from "../qvac/goaly-builder.mjs";
import { askQvac, getHealth } from "../qvac/server.mjs";
test("Goaly keeps user input separate from its advisory rules", () => {
  const history = [
    { role: "user", content: "I will run 5 km tomorrow" },
    { role: "assistant", content: "What proof can verify it?" },
  ];
  const m = goalyMessages(history);
  assert.equal(m[0].role, "system");
  assert.deepEqual(m.slice(1), history);
  assert.match(m[0].content, /authorize payouts/i);
  assert.match(m[0].content, /opponents/i);
  assert.match(m[0].content, /Never repeat a question that the user has answered/i);
  assert.match(m[0].content, /generate deposit links/i);
  assert.match(m[0].content, /your ticket matches a winning number in the named draw/i);
  assert.match(m[0].content, /Never reject a goal only because success is uncertain/i);
});
test("Goaly builder uses strict structured output and preserves current values", () => {
  const draft = { title: "", successRule: "", proofSource: "", stake: "5.00", deadline: "", visibility: "public" };
  const messages = goalyBuilderMessages([{ role: "user", content: "I want a lottery challenge" }], draft);
  assert.equal(messages[0].role, "system");
  assert.ok(messages[0].content.length < 2400, "builder system prompt must leave room for the structured reply");
  assert.match(messages[0].content, /Create goal button in your chat as the user's final confirmation/i);
  assert.match(messages[0].content, /user must still approve the payment in KaleidoSwap/i);
  assert.equal(goalyBuilderFormat.json_schema.strict, true);
  const payload = {
    answer: "Which draw do you mean?",
    readyToCreate: false,
    draft: { title: "Lottery challenge", successRule: null, proofSource: null, stake: "5.00", deadline: null, visibility: "public" },
  };
  assert.deepEqual(parseGoalyBuilderAnswer(JSON.stringify(payload)), payload);
  assert.equal(goalyBuilderFormat.json_schema.schema.properties.readyToCreate.type, "boolean");
  assert.throws(() => parseGoalyBuilderAnswer("invalid"), /invalid challenge draft/i);
});
test("Goaly builder treats prefilled values as unconfirmed until the user confirms them", () => {
  const draft = { title: "", successRule: "", proofSource: "", stake: "5.00", deadline: "2026-10-23T18:00", visibility: "public" };
  const messages = goalyBuilderMessages([{ role: "user", content: "Help me prepare a challenge" }], draft);

  assert.match(messages[0].content, /prefilled values are unconfirmed/i);
  assert.match(messages[0].content, /confirm title\/rule/i);
});
test("Goaly builder accepts any written proof description without a URL or special format", () => {
  const draft = { title: "", successRule: "", proofSource: "", stake: "5.00", deadline: "", visibility: "public" };
  const messages = goalyBuilderMessages([{ role: "user", content: "Help me prepare a challenge" }], draft);

  assert.match(messages[0].content, /custom challenge/i);
  assert.match(messages[0].content, /proof source is free-form.*any non-empty description/i);
  assert.match(messages[0].content, /do not require a url, special format/i);
  assert.match(messages[0].content, /written proof statements and image attachments/i);
  assert.match(messages[0].content, /chat image is context only/i);
  assert.match(messages[0].content, /external verification/i);
  assert.match(messages[0].content, /source, stake, future deadline, and visibility/i);
  assert.match(messages[0].content, /my local time/i);
  assert.match(messages[0].content, /do not ask.*timezone/i);
  assert.match(messages[0].content, /never say you created or published the challenge, requested or sent an invoice/i);
});

test("structured challenge replies can request enough completion tokens for the full JSON draft", async () => {
  await askQvac(
    goalyBuilderMessages([{ role: "user", content: "Yes, I confirm all details." }], {
      title: "Seven-day reading goal",
      successRule: "Read for 30 minutes per day.",
      proofSource: "Daily log",
      stake: "1",
      deadline: "2026-10-25T20:00",
      visibility: "public",
    }),
    goalyBuilderFormat,
    async (_url, init) => {
      assert.equal(JSON.parse(init.body).max_tokens, 512);
      return Response.json({
        choices: [{ message: { content: JSON.stringify({
          answer: "Review the summary and select Create goal if it is correct.",
          readyToCreate: true,
          draft: {
            title: "Seven-day reading goal",
            successRule: "Read for 30 minutes per day.",
            proofSource: "Daily log",
            stake: "1",
            deadline: "2026-10-25T20:00",
            visibility: "public",
          },
        }) } }],
      });
    },
    512,
  );
});
test("QVAC reports when a completion is truncated instead of returning partial JSON", async () => {
  await assert.rejects(
    askQvac(
      [{ role: "user", content: "Confirm this challenge." }],
      goalyBuilderFormat,
      async () => Response.json({
        choices: [{ finish_reason: "length", message: { content: '{"answer":"partial' } }],
      }),
      512,
    ),
    /response was truncated/i,
  );
});
test("local QVAC returns an actual model reply and never a canned fallback", async () => {
  const history = [{ role: "user", content: "Wake up at 7" }];
  const result = await askQvac(
    goalyMessages(history),
    undefined,
    async (url, init) => {
      assert.equal(url, "http://127.0.0.1:11434/v1/chat/completions");
      const b = JSON.parse(init.body);
      assert.equal(b.model, "goal-digger");
      assert.equal(b.messages[0].role, "system");
      return Response.json({
        choices: [{ message: { content: "Choose a timezone and a proof deadline." } }],
      });
    },
  );
  assert.match(result.answer, /timezone/);
  await assert.rejects(
    askQvac(goalyMessages([{ role: "user", content: "Hi" }]), undefined, async () => {
      throw Error("offline");
    }),
    (e) => e.status === 503,
  );
});

test("Goaly and readiness use the configured QVAC base URL", async () => {
  const previousBaseUrl = process.env.QVAC_BASE_URL;
  process.env.QVAC_BASE_URL = "http://127.0.0.1:11435";
  try {
    const healthUrls = [];
    const health = await getHealth(async (url) => {
      healthUrls.push(url);
      return url.endsWith("/v1/models")
        ? Response.json({ data: [{ id: "goal-digger" }] })
        : Response.json({ pubkey: "rgb-node" });
    });
    assert.equal(health.status, "ok");
    assert.ok(healthUrls.includes("http://127.0.0.1:11435/v1/models"));

    await askQvac(
      goalyMessages([{ role: "user", content: "Set a goal" }]),
      undefined,
      async (url) => {
        assert.equal(url, "http://127.0.0.1:11435/v1/chat/completions");
        return Response.json({
          choices: [{ message: { content: "Choose a deadline." } }],
        });
      },
    );
  } finally {
    if (previousBaseUrl === undefined) delete process.env.QVAC_BASE_URL;
    else process.env.QVAC_BASE_URL = previousBaseUrl;
  }
});
