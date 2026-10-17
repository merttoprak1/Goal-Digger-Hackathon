import { test } from "node:test";
import assert from "node:assert/strict";
import { goalyMessages } from "../qvac/goaly.mjs";
import { askQvac } from "../qvac/server.mjs";
test("Goaly keeps user input separate from its advisory rules", () => {
  const m = goalyMessages("I will run 5 km tomorrow");
  assert.equal(m[0].role, "system");
  assert.equal(m[1].content, "I will run 5 km tomorrow");
  assert.match(m[0].content, /cannot.*payout/i);
  assert.match(m[0].content, /opponents/i);
});
test("local QVAC returns an actual model reply and never a canned fallback", async () => {
  const result = await askQvac(
    goalyMessages("Wake up at 7"),
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
    askQvac(goalyMessages("Hi"), undefined, async () => {
      throw Error("offline");
    }),
    (e) => e.status === 503,
  );
});
