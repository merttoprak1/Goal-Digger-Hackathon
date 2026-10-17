import { test } from "node:test";
import assert from "node:assert/strict";
import { askGoaly } from "./goaly.ts";
test("Goaly uses the local chat proxy even while challenge mocks are enabled", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async (url: RequestInfo | URL, init?: RequestInit) => {
      assert.equal(url, "/qvac/chat");
      assert.deepEqual(JSON.parse(String(init?.body)), { prompt: "Wake up at 7" });
      return Response.json({ answer: "Which timezone?" });
    },
  );
  assert.equal(await askGoaly("Wake up at 7"), "Which timezone?");
});
test("Goaly rejects oversized requests and shows upstream errors without a fake reply", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return Response.json({ error: "QVAC is unavailable." }, { status: 503 });
  });
  await assert.rejects(askGoaly("x".repeat(501)));
  assert.equal(calls, 0);
  await assert.rejects(askGoaly("Hello"), /QVAC is unavailable/);
});
