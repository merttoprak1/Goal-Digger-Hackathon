import { test } from "node:test";
import assert from "node:assert/strict";
import { goalyMessages } from "../qvac/goaly.mjs";
import { goalyBuilderFormat, goalyBuilderMessages, parseGoalyBuilderAnswer } from "../qvac/goaly-builder.mjs";
import { askQvac } from "../qvac/server.mjs";
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
  assert.match(messages[0].content, /must press the page's Create challenge and deposit button/i);
  assert.equal(goalyBuilderFormat.json_schema.strict, true);
  const payload = {
    answer: "Which draw do you mean?",
    draft: { title: "Lottery challenge", successRule: null, proofSource: null, stake: "5.00", deadline: null, visibility: "public" },
  };
  assert.deepEqual(parseGoalyBuilderAnswer(JSON.stringify(payload)), payload);
  assert.throws(() => parseGoalyBuilderAnswer("invalid"), /invalid challenge draft/i);
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
