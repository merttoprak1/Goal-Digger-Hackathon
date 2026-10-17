import { test } from "node:test";
import assert from "node:assert/strict";
import { askGoaly } from "../app/lib/goaly.ts";
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
    return Response.json({ answer: "Review the proposed draft.", draft });
  });
  assert.deepEqual(
    await askGoaly([{ role: "user", content: "Build a lottery challenge" }], draft),
    { answer: "Review the proposed draft.", draft },
  );
});
