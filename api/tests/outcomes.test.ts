import { afterEach, it, expect, vi } from "vitest";
import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createApp } from "../src/app.js";
import { openStakeDeposits } from "../../vault/stake-deposits.mjs";
import { ApiError } from "../src/middlewares/error-handler.js";
import sharp from "sharp";
const cleanup: Array<() => void> = [];
afterEach(() => {
  vi.useRealTimers();
  for (const f of cleanup.splice(0).reverse()) f();
});
async function setup(template = "wake_up") {
  const dir = mkdtempSync(join(tmpdir(), "outcomes-"));
  cleanup.push(() => rmSync(dir, { recursive: true }));
  const databasePath = join(dir, "api.sqlite");
  const invoices = new Map<string, Record<string, unknown>>();
  let settled = true;
  let onCustomReview: (() => void) | null = null;
  let customReviewWait: Promise<void> | null = null;
  let customReviewCalls = 0;
  let lastCustomReviewInput: Record<string, unknown> | null = null;
  const stakes = openStakeDeposits({
    databasePath,
    token: "secret",
    fetchService: async (url, init) => {
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      const id = body?.paymentId ?? String(url).split("/").at(-1)!;
      if (body)
        invoices.set(id, {
          paymentId: id,
          amountAtomic: body.amountAtomic,
          assetId: "rgb:lX~ToKsO-Iup7dJ5-UM794sA-9WD21ge-VHYzBGb-E9PA_h0",
          invoice: "rgb:" + id,
          recipientId: "sbc:wvout:" + id,
          status: "awaiting_payment",
          expirationTimestamp: Date.now() / 1000 + 3600,
        });
      return Response.json({
        ...invoices.get(id),
        status: body ? "awaiting_payment" : settled ? "settled" : "pending",
        txid: "a".repeat(64),
      });
    },
  });
  cleanup.push(() => stakes.close());
  let customVerdict: "accepted" | "rejected" | "unclear" = "accepted";
  let reviewerError: ApiError | null = null;
  const app = createApp({
    databasePath,
    stakeDeposits: stakes,
    proofReviewer: async (input) => {
      if (reviewerError) throw reviewerError;
      if ("proofMethod" in input) {
        customReviewCalls++;
        lastCustomReviewInput = structuredClone(input);
        onCustomReview?.();
        if (customReviewWait) await customReviewWait;
      }
      return {
        verdict: "proofMethod" in input
          ? customVerdict
          : Number(input.evidence.match(/-?\d+/)?.[0]) === input.expectedAnswer
            ? "accepted"
            : "rejected",
        reason: "Test reviewer assessment.",
        reviewer: "local-qvac",
      };
    },
  });
  cleanup.push(() => app.locals.close());
  const a = (await request(app).post("/api/sessions").send({ displayName: "Mert" })).body;
  const b = (await request(app).post("/api/sessions").send({ displayName: "Ege" })).body;
  const starts = Date.now() + 3600000;
  const deadline = starts + 600000;
  const challenge = (
    await request(app)
      .post("/api/challenges")
      .set("Authorization", `Bearer ${a.token}`)
      .send({
        template,
        title: "Wake up",
        successRule: "Solve the fresh problem",
        proofMethod:
          template === "wake_up"
            ? "timed_math"
            : template === "custom"
              ? "custom"
              : template === "run"
                ? "activity_record"
                : "official_result",
        proofSource: "Server response and timestamp",
        timezone: "Europe/Rome",
        bettingCutoff: new Date(starts - 60000).toISOString(),
        startsAt: new Date(starts).toISOString(),
        proofDeadline: new Date(deadline).toISOString(),
        creatorStakeAtomic: "1000000",
      })
  ).body.challenge;
  const base = "/api/challenges/" + challenge.id;
  const post = (path: string, body: unknown = {}, token = a.token) =>
    request(app)
      .post(base + path)
      .set("Authorization", `Bearer ${token}`)
      .send(body);
  const get = (path: string, token = a.token) =>
    request(app)
      .get(base + path)
      .set("Authorization", `Bearer ${token}`);
  await post("/creator-deposit");
  await get("/creator-deposit");
  await post("/publish");
  const opponent = async () => {
    await post("/opponent-deposit", { amountAtomic: "2000000" }, b.token);
    await get("/opponent-deposit", b.token);
  };
  const time = (t: number) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(t);
  };
  return {
    app,
    databasePath,
    challengeId: challenge.id,
    a,
    b,
    base,
    post,
    get,
    opponent,
    time,
    starts,
    deadline,
    set: (v: boolean) => {
      settled = v;
    },
    setCustomVerdict: (verdict: "accepted" | "rejected" | "unclear") => {
      customVerdict = verdict;
    },
    setReviewerError: (error: ApiError | null) => {
      reviewerError = error;
    },
    setOnCustomReview: (callback: (() => void) | null) => {
      onCustomReview = callback;
    },
    setCustomReviewWait: (wait: Promise<void> | null) => {
      customReviewWait = wait;
    },
    customReviewCalls: () => customReviewCalls,
    lastCustomReviewInput: () => lastCustomReviewInput,
  };
}

const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==", "base64");
function postImage(f: Awaited<ReturnType<typeof setup>>, statement?: string, bytes = tinyPng, contentType = "image/png") {
  const req = request(f.app)
    .post(f.base + "/proof-note")
    .set("Authorization", `Bearer ${f.a.token}`);
  if (statement !== undefined) req.field("statement", statement);
  return req.attach("image", bytes, { filename: "proof.png", contentType });
}

it("accepts image-only custom proof", async () => {
  const f = await setup("custom");
  f.time(f.starts);
  const response = await postImage(f);
  expect(response.status).toBe(200);
  expect(response.body.review.verdict).toBe("accepted");
  expect(f.lastCustomReviewInput()).toMatchObject({ evidence: "" });
  expect(f.lastCustomReviewInput()).toHaveProperty("image.mimeType", "image/png");
  expect(f.lastCustomReviewInput()).toHaveProperty("image.dataUrl", `data:image/png;base64,${tinyPng.toString("base64")}`);
});

it("accepts text plus image proof", async () => {
  const f = await setup("custom");
  f.time(f.starts);
  const response = await postImage(f, "I completed the goal.");
  expect(response.status).toBe(200);
  expect(f.lastCustomReviewInput()).toMatchObject({ evidence: "I completed the goal.", image: { mimeType: "image/png" } });
});

it("returns the saved Goaly verdict to the creator after refresh, without image bytes", async () => {
  const f = await setup("custom");
  f.time(f.starts);
  await postImage(f, "I completed the goal.");
  const creator = await f.get("/proof-note");
  expect(creator.status).toBe(200);
  expect(creator.body.review).toEqual({
    verdict: "accepted",
    reason: "Test reviewer assessment.",
    reviewer: "local-qvac",
  });
  expect(JSON.stringify(creator.body)).not.toContain("data:image");
  const opponent = await f.get("/proof-note", f.b.token);
  expect(opponent.status).toBe(404);
});

it("rejects empty custom proof evidence", async () => {
  const f = await setup("custom");
  const response = await f.post("/proof-note", {});
  expect(response.status).toBe(400);
  expect(response.body.error.code).toBe("INVALID_PROOF");
  expect(f.customReviewCalls()).toBe(0);
});

it("ends the challenge when the creator proof is accepted before the start", async () => {
  const f = await setup("custom");
  await f.opponent();
  f.time(f.starts - 120000);
  const response = await f.post("/proof-note", { statement: "I completed the goal." });
  expect(response.status).toBe(200);
  expect(response.body.outcome.status).toBe("success");
  expect((await f.get("/outcome")).body.outcome.status).toBe("success");
});

it("rejects mismatched MIME signatures and oversized images before reviewer call", async () => {
  const f = await setup("custom");
  f.time(f.starts);
  const mismatch = await postImage(f, "A proof", tinyPng, "image/jpeg");
  expect(mismatch.status).toBe(400);
  const corrupt = await postImage(f, "A proof", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png");
  expect(corrupt.status).toBe(400);
  const oversized = await postImage(f, "A proof", Buffer.alloc(5 * 1024 * 1024 + 1), "image/png");
  expect(oversized.status).toBe(413);
  expect(f.customReviewCalls()).toBe(0);
});

it("requires the same image hash for a pending retry", async () => {
  const f = await setup("custom");
  f.time(f.starts);
  f.setReviewerError(new ApiError(503, "QVAC unavailable.", "PROOF_REVIEW_UNAVAILABLE"));
  const first = await postImage(f, "Same proof");
  expect(first.status).toBe(503);
  f.setReviewerError(null);
  const changedImage = await sharp(tinyPng).png({ compressionLevel: 1 }).toBuffer();
  expect(changedImage).not.toEqual(tinyPng);
  const changed = await postImage(f, "Same proof", changedImage);
  expect(changed.status).toBe(409);
  expect(changed.body.error.code).toBe("PROOF_REVIEW_PENDING");
  const retry = await postImage(f, "Same proof");
  expect(retry.status).toBe(200);
});

it("persists proof image bytes across API restart", async () => {
  const f = await setup("custom");
  f.time(f.starts);
  f.setReviewerError(new ApiError(503, "QVAC unavailable.", "PROOF_REVIEW_UNAVAILABLE"));
  await postImage(f, "Persist this image");
  const saved = f.app.locals.sessionStore.getProofReview(f.challengeId);
  expect(saved).toMatchObject({ imageMimeType: "image/png", imageHash: expect.any(String) });
  expect(saved.imageBytes).toEqual(tinyPng);

  const second = createApp({
    databasePath: f.databasePath,
    proofReviewer: async () => ({ verdict: "accepted", reason: "Image supports the rule.", reviewer: "local-qvac" }),
  });
  cleanup.push(() => second.locals.close());
  const retry = await request(second).post(f.base + "/proof-note")
    .set("Authorization", `Bearer ${f.a.token}`)
    .field("statement", "Persist this image")
    .attach("image", tinyPng, { filename: "proof.png", contentType: "image/png" });
  expect(retry.status).toBe(200);
});

it("allows early success finalization after accepted proof", async () => {
  const f = await setup("custom");
  await f.opponent();
  f.time(f.starts);
  expect((await f.post("/proof-note", { statement: "I completed the goal." })).status).toBe(200);
  const response = await f.post("/finalize");
  expect(response.status).toBe(200);
  expect(response.body.outcome.status).toBe("success");
});

it("blocks early finalization without accepted proof", async () => {
  const f = await setup("custom");
  f.time(f.starts);
  const response = await f.post("/finalize");
  expect(response.status).toBe(409);
  expect(response.body.error.code).toBe("PROOF_WINDOW_OPEN");
});

it("blocks early failure finalization after rejected proof", async () => {
  const f = await setup("custom");
  await f.opponent();
  f.setCustomVerdict("rejected");
  f.time(f.starts);
  await f.post("/proof-note", { statement: "I completed the goal." });
  expect((await f.post("/finalize")).body.error.code).toBe("PROOF_WINDOW_OPEN");
  f.time(f.deadline);
  expect((await f.post("/finalize")).body.outcome.status).toBe("failure");
});

it("settles paid stakes when another invoice was never paid", async () => {
  const f = await setup("custom");
  await f.opponent();
  const late = (await request(f.app).post("/api/sessions").send({ displayName: "Late" })).body;
  await f.post("/opponent-deposit", { amountAtomic: "1000000" }, late.token);
  f.time(f.starts - 120000);
  const response = await f.post("/proof-note", { statement: "I completed the goal." });
  expect(response.status).toBe(200);
  expect(response.body.outcome.status).toBe("success");
  expect(response.body.outcome.stakes).toHaveLength(2);
});

it("blocks early success finalization until all stakes are resolved", async () => {
  const f = await setup("custom");
  f.set(false);
  await f.opponent();
  f.time(f.starts);
  await f.post("/proof-note", { statement: "I completed the goal." });
  expect((await f.post("/finalize")).status).toBe(409);
  expect((await f.get("/outcome")).body.outcome).toBeNull();
});
it("saves success after the deadline from an accepted proof, with an immutable exact pool snapshot", async () => {
  const f = await setup();
  await f.opponent();
  f.time(f.starts);
  const problem = (await f.post("/math/problem")).body.problem;
  await f.post("/math/submit", {
    problemId: problem.id,
    answer: String(problem.left + problem.right),
  });
  expect((await f.post("/finalize")).status).toBe(409);
  f.time(f.deadline);
  const response = await f.post("/finalize");
  expect(response.status).toBe(200);
  expect(response.body.outcome.status).toBe("success");
  expect(response.body.outcome.poolAtomic).toBe("3000000");
  expect(response.body.outcome.proofId).toBe(problem.id);
  expect(response.body.outcome.stakes).toHaveLength(2);
  expect((await f.post("/finalize", {}, f.b.token)).body).toEqual(response.body);
  const second = createApp({ databasePath: f.databasePath });
  cleanup.push(() => second.locals.close());
  expect(
    (
      await request(second)
        .get(f.base + "/outcome")
        .set("Authorization", `Bearer ${f.b.token}`)
    ).body,
  ).toEqual(response.body);
});
it("saves failure for missing or rejected proof only after the deadline", async () => {
  const f = await setup();
  await f.opponent();
  expect((await f.get("/outcome")).body.outcome).toBeNull();
  expect((await f.post("/finalize", { status: "success" })).status).toBe(400);
  f.time(f.starts);
  const problem = (await f.post("/math/problem")).body.problem;
  await f.post("/math/submit", { problemId: problem.id, answer: "0" });
  f.time(f.deadline);
  const result = await f.post("/finalize");
  expect(result.body.outcome.status).toBe("failure");
  expect(result.body.outcome.proofId).toBeNull();
  expect((await f.get("")).body.challenge.status).toBe("failed");
});
it("holds finalization for no opponents, unresolved invoices, or late credits", async () => {
  const f = await setup();
  f.time(f.deadline);
  expect((await f.post("/finalize")).status).toBe(409);
  f.time(f.starts - 120000);
  f.set(false);
  await f.opponent();
  f.time(f.deadline);
  expect((await f.post("/finalize")).status).toBe(409);
  f.set(true);
  await f.get("/opponent-deposit", f.b.token);
  expect((await f.post("/finalize")).status).toBe(409);
  expect((await f.get("/outcome")).body.outcome).toBeNull();
});
it("requires a participant session and allows only published challenges to expose outcomes", async () => {
  const f = await setup();
  expect((await request(f.app).get(f.base + "/outcome")).status).toBe(401);
  expect(
    (
      await request(f.app)
        .post("/api/challenges/missing/finalize")
        .set("Authorization", `Bearer ${f.a.token}`)
        .send({})
    ).status,
  ).toBe(404);
});

it("records failure when the creator sends no proof", async () => {
  const f = await setup();
  await f.opponent();
  f.time(f.deadline);
  const responses = await Promise.all([
    f.post("/finalize"),
    f.post("/finalize", {}, f.b.token),
  ]);
  expect(responses[0].status).toBe(200);
  expect(responses[1].body).toEqual(responses[0].body);
  expect(responses[0].body.outcome).toMatchObject({
    status: "failure",
    proofId: null,
    poolAtomic: "3000000",
  });
});
it("does not decide official results with timed math rules", async () => {
  const f = await setup("exam");
  await f.opponent();
  f.time(f.deadline);
  expect((await f.post("/finalize")).status).toBe(409);
  expect((await f.get("/outcome")).body.outcome).toBeNull();

  const activity = await setup("run");
  expect((await activity.post("/proof-note", { statement: "I ran today." })).status).toBe(409);
  activity.time(activity.deadline);
  expect((await activity.post("/finalize")).status).toBe(409);
});

it("reviews custom evidence and only accepted proof can produce success", async () => {
  const f = await setup("custom");
  await f.opponent();
  f.time(f.starts);
  const response = await f.post("/proof-note", { statement: "I completed the stated goal." });
  expect(response.status).toBe(200);
  expect(response.body.saved).toBe(true);
  expect(response.body.review).toEqual({
    verdict: "accepted",
    reason: "Test reviewer assessment.",
    reviewer: "local-qvac",
  });
  expect(response.body.outcome.status).toBe("success");
  f.time(f.deadline);
  const result = await f.post("/finalize");
  expect(result.body.outcome).toMatchObject({ status: "success", proofId: f.base.split("/").at(-1) });
});

it("stores a rejected custom review but finalizes as failure", async () => {
  const f = await setup("custom");
  await f.opponent();
  f.time(f.starts);
  f.setCustomVerdict("rejected");
  const response = await f.post("/proof-note", { statement: "This does not prove completion." });
  expect(response.body.review.verdict).toBe("rejected");
  f.time(f.deadline);
  expect((await f.post("/finalize")).body.outcome.status).toBe("failure");
});

it("does not persist unclear custom evidence and allows a clearer retry", async () => {
  const f = await setup("custom");
  await f.opponent();
  f.time(f.starts);
  f.setCustomVerdict("unclear");
  const unclear = await f.post("/proof-note", { statement: "Maybe I did it." });
  expect(unclear.status).toBe(422);
  expect(unclear.body.error.code).toBe("PROOF_REVIEW_UNCLEAR");
  f.setCustomVerdict("accepted");
  const retry = await f.post("/proof-note", { statement: "I completed the stated goal." });
  expect(retry.status).toBe(200);
  expect(retry.body.review.verdict).toBe("accepted");
});

it("retains a pending custom proof review when Goaly is unavailable", async () => {
  const f = await setup("custom");
  await f.opponent();
  f.time(f.starts);
  f.setReviewerError(new ApiError(503, "QVAC is unavailable.", "PROOF_REVIEW_UNAVAILABLE"));
  const failed = await f.post("/proof-note", { statement: "I completed the stated goal." });
  expect(failed.status).toBe(503);
  expect(failed.body.error.code).toBe("PROOF_REVIEW_UNAVAILABLE");
  expect(f.app.locals.sessionStore.getProofReview(f.challengeId)).toMatchObject({
    statement: "I completed the stated goal.",
    reviewVerdict: "pending",
  });
  f.setReviewerError(null);
  expect((await f.post("/proof-note", { statement: "I completed the stated goal." })).status).toBe(200);
});

it("blocks failure finalization while a timely proof review is unresolved", async () => {
  const f = await setup("custom");
  await f.opponent();
  f.time(f.starts);
  f.setReviewerError(new ApiError(503, "QVAC is unavailable.", "PROOF_REVIEW_UNAVAILABLE"));
  await f.post("/proof-note", { statement: "I completed the stated goal." });
  f.time(f.deadline);
  const result = await f.post("/finalize");
  expect(result.status).toBe(409);
  expect(result.body.error.code).toBe("PROOF_REVIEW_PENDING");
  expect((await f.get("/outcome")).body.outcome).toBeNull();
});

it("retries the exact timely pending proof after restart and deadline", async () => {
  const f = await setup("custom");
  await f.opponent();
  f.time(f.starts);
  f.setReviewerError(new ApiError(503, "QVAC is unavailable.", "PROOF_REVIEW_UNAVAILABLE"));
  await f.post("/proof-note", { statement: "I completed the stated goal." });
  f.time(f.deadline);
  const second = createApp({
    databasePath: f.databasePath,
    proofReviewer: async () => ({
      verdict: "accepted",
      reason: "The evidence supports the stated goal.",
      reviewer: "local-qvac",
    }),
  });
  cleanup.push(() => second.locals.close());
  const retry = await request(second)
    .post(f.base + "/proof-note")
    .set("Authorization", `Bearer ${f.a.token}`)
    .send({ statement: "I completed the stated goal." });
  expect(retry.status).toBe(200);
  expect(retry.body.review.verdict).toBe("accepted");
  expect((await request(second).post(f.base + "/finalize").set("Authorization", `Bearer ${f.a.token}`).send({})).body.outcome.status).toBe("success");
});

it("rejects changed evidence while a previous timely review is pending", async () => {
  const f = await setup("custom");
  f.time(f.starts);
  f.setReviewerError(new ApiError(503, "QVAC is unavailable.", "PROOF_REVIEW_UNAVAILABLE"));
  await f.post("/proof-note", { statement: "I completed the stated goal." });
  f.setReviewerError(null);
  const changed = await f.post("/proof-note", { statement: "Different evidence." });
  expect(changed.status).toBe(409);
  expect(changed.body.error.code).toBe("PROOF_REVIEW_PENDING");
});

it("runs only one Goaly review at a time for a pending challenge proof", async () => {
  const f = await setup("custom");
  f.time(f.starts);
  let release!: () => void;
  let markStarted!: () => void;
  const wait = new Promise<void>((resolve) => { release = resolve; });
  const started = new Promise<void>((resolve) => { markStarted = resolve; });
  f.setCustomReviewWait(wait);
  f.setOnCustomReview(markStarted);
  const first = f.post("/proof-note", { statement: "I completed the goal." }).then((result) => result);
  await started;
  let secondSettled = false;
  const second = f.post("/proof-note", { statement: "I completed the goal." }).then((result) => {
    secondSettled = true;
    return result;
  });
  await new Promise<void>((resolve) => setTimeout(resolve, 25));
  release();
  const [firstResult, secondResult] = await Promise.all([first, second]);
  expect(firstResult.status).toBe(200);
  expect(secondSettled).toBe(true);
  expect(secondResult.status).toBe(409);
  expect(secondResult.body.error.code).toBe("PROOF_REVIEW_PENDING");
  expect(f.customReviewCalls()).toBe(1);
});

it("does not overwrite an accepted proof with later evidence", async () => {
  const f = await setup("custom");
  await f.opponent();
  f.time(f.starts);
  expect((await f.post("/proof-note", { statement: "I completed the goal." })).status).toBe(200);
  const replacement = await f.post("/proof-note", { statement: "A different statement." });
  expect(replacement.status).toBe(409);
  expect(replacement.body.error.code).toBe("PROOF_ACCEPTED");
  f.time(f.deadline);
  expect((await f.post("/finalize")).body.outcome.status).toBe("success");
});

it("does not let a slow retry overwrite accepted proof after the deadline", async () => {
  const f = await setup("custom");
  await f.opponent();
  f.time(f.starts);
  expect((await f.post("/proof-note", { statement: "I completed the goal." })).status).toBe(200);
  f.time(f.deadline - 1);
  f.setOnCustomReview(() => f.time(f.deadline));
  const lateReview = await f.post("/proof-note", { statement: "A later replacement statement." });
  expect(lateReview.status).toBe(409);
  expect(lateReview.body.error.code).toBe("PROOF_ACCEPTED");
  f.setOnCustomReview(null);
  f.time(f.deadline);
  const outcome = await f.post("/finalize");
  expect(outcome.body.outcome).toMatchObject({ status: "success", proofId: f.base.split("/").at(-1) });
});

it("accepts a full-length Unicode written proof within the API request limit", async () => {
  const f = await setup("custom");
  f.time(f.starts);
  const statement = "証".repeat(1000);
  const response = await f.post("/proof-note", { statement });
  expect(response.status).toBe(200);
  expect(response.body.review.verdict).toBe("accepted");
});
