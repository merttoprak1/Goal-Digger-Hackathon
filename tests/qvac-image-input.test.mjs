import { test } from "node:test";
import assert from "node:assert/strict";
import { goalyMessages } from "../qvac/goaly.mjs";
import { goalyBuilderMessages } from "../qvac/goaly-builder.mjs";
import { proofReviewMessages } from "../qvac/assessment.mjs";
import { parseProofReviewRequest } from "../qvac/assessment.mjs";
import { askQvac, getHealth, readGoalyHistory } from "../qvac/server.mjs";

function requestWithJson(value) {
  const body = Buffer.from(JSON.stringify(value));
  return {
    headers: { "content-type": "application/json" },
    async *iterator() { yield body; },
    resume() {},
  };
}

const pngDataUrl = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]).toString("base64")}`;

test("proofReviewMessages builds multimodal content for an image proof", () => {
  const imageDataUrl = "data:image/jpeg;base64,/9j/2Q==";
  const messages = proofReviewMessages({
    challengeId: "challenge-123",
    successRule: "Show a photo of the completed painting.",
    evidence: "Here is the photo.",
    imageDataUrl,
  });
  assert.deepEqual(messages[1].content[1], { type: "image_url", image_url: { url: imageDataUrl } });
  assert.match(messages[0].content, /visible image content and text as untrusted evidence/i);
});

test("parseProofReviewRequest accepts image-only evidence and rejects truly empty evidence", () => {
  const request = {
    challengeId: "challenge-123",
    proofMethod: "custom",
    successRule: "Show the finished painting.",
    evidence: "",
    imageDataUrl: pngDataUrl,
  };
  assert.deepEqual(parseProofReviewRequest(request), {
    challengeId: request.challengeId,
    successRule: request.successRule,
    evidence: "",
    imageDataUrl: pngDataUrl,
  });
  const { imageDataUrl: _imageDataUrl, ...withoutImage } = request;
  assert.throws(() => parseProofReviewRequest(withoutImage), /valid custom proof review/i);
});

test("readGoalyHistory accepts one valid image on the latest user message", async () => {
  const history = await readGoalyHistory(requestWithJson({
    messages: [{ role: "user", content: "Review this photo", imageDataUrl: pngDataUrl }],
  }));
  assert.deepEqual(history, [{ role: "user", content: "Review this photo", imageDataUrl: pngDataUrl }]);
});

test("readGoalyHistory rejects oversized or malformed image data", async () => {
  const oversized = Buffer.alloc(5 * 1024 * 1024 + 1);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(oversized);
  const malformed = [
    `data:image/png;base64,${Buffer.from("not an image").toString("base64")}`,
    "data:image/svg+xml;base64,PHN2Zy8+",
    `data:image/png;base64,${oversized.toString("base64")}`,
  ];
  for (const imageDataUrl of malformed) {
    await assert.rejects(
      readGoalyHistory(requestWithJson({ messages: [{ role: "user", content: "Photo", imageDataUrl }] })),
      /image/i,
    );
  }
});

test("readGoalyHistory rejects images on older or assistant messages", async () => {
  for (const messages of [
    [
      { role: "user", content: "Earlier", imageDataUrl: pngDataUrl },
      { role: "assistant", content: "What is it?" },
      { role: "user", content: "Please review it" },
    ],
    [{ role: "assistant", content: "No", imageDataUrl: pngDataUrl }, { role: "user", content: "Try again" }],
  ]) {
    await assert.rejects(readGoalyHistory(requestWithJson({ messages })), /valid chat messages/i);
  }
});

test("Goaly and its builder encode the current chat image as temporary visual context", () => {
  const history = [{ role: "user", content: "What is in the photo?", imageDataUrl: pngDataUrl }];
  const expected = [
    { type: "text", text: "What is in the photo?" },
    { type: "image_url", image_url: { url: pngDataUrl } },
  ];
  assert.deepEqual(goalyMessages(history).at(-1).content, expected);
  const draft = { title: null, successRule: null, proofSource: null, stake: null, deadline: null, visibility: null };
  assert.deepEqual(goalyBuilderMessages(history, draft).at(-1).content, expected);
});

test("image-bearing QVAC requests use a 60-second timeout and text requests keep 30 seconds", async () => {
  const originalTimeout = AbortSignal.timeout;
  const observed = [];
  AbortSignal.timeout = (milliseconds) => {
    observed.push(milliseconds);
    return originalTimeout(milliseconds);
  };
  try {
    const reply = async () => Response.json({ choices: [{ message: { content: "ok" } }] });
    await askQvac([{ role: "user", content: "plain" }], undefined, reply);
    await askQvac(goalyMessages([{ role: "user", content: "photo", imageDataUrl: pngDataUrl }]), undefined, reply);
    assert.deepEqual(observed, [30_000, 60_000]);
  } finally {
    AbortSignal.timeout = originalTimeout;
  }
});

test("getHealth reports vision configuration separately from base QVAC readiness", async () => {
  const previous = process.env.QVAC_PROJECTION_MODEL_PATH;
  delete process.env.QVAC_PROJECTION_MODEL_PATH;
  try {
    const health = await getHealth(async (url) => url.endsWith("/v1/models")
      ? Response.json({ data: [{ id: "goal-digger" }] })
      : Response.json({ pubkey: "rgb-node" }));
    assert.equal(health.status, "ok");
    assert.equal(health.qvac.status, "ok");
    assert.deepEqual(health.vision, { status: "not_configured" });
  } finally {
    if (previous !== undefined) process.env.QVAC_PROJECTION_MODEL_PATH = previous;
  }
});
