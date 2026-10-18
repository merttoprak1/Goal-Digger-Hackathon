import { test } from "node:test";
import assert from "node:assert/strict";
import { askGoaly } from "../app/lib/goaly.ts";

test("askGoaly sends only the latest user image as temporary context", async () => {
  const originalFetch = globalThis.fetch;
  let body: Record<string, unknown> | undefined;
  globalThis.fetch = async (_input, init) => {
    body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Response.json({ answer: "I can see the attached image." });
  };
  try {
    const result = await askGoaly([
      { role: "user", content: "Earlier photo", imageDataUrl: "data:image/png;base64,OLD" },
      { role: "assistant", content: "What would you like help with?" },
      { role: "user", content: "Please look at this", imageDataUrl: "data:image/png;base64,NEW" },
    ]);
    assert.equal(result.answer, "I can see the attached image.");
    assert.deepEqual(body?.messages, [
      { role: "user", content: "Earlier photo" },
      { role: "assistant", content: "What would you like help with?" },
      { role: "user", content: "Please look at this", imageDataUrl: "data:image/png;base64,NEW" },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
