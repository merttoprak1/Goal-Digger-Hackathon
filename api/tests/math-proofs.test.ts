import { afterEach, it, expect, vi } from "vitest";
import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../src/app.js";
import { openStakeDeposits } from "../../stake-deposits.mjs";
const cleanup: Array<() => void> = [];
afterEach(() => {
  vi.useRealTimers();
  for (const fn of cleanup.splice(0).reverse()) fn();
});
async function setup() {
  const dir = mkdtempSync(join(tmpdir(), "math-proofs-"));
  cleanup.push(() => rmSync(dir, { recursive: true }));
  const databasePath = join(dir, "api.sqlite");
  let paymentId = "";
  const stakes = openStakeDeposits({
    databasePath,
    token: "secret",
    fetchService: async (_url, init) => {
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      if (body) paymentId = body.paymentId;
      return Response.json({
        paymentId,
        assetId: "rgb:lX~ToKsO-Iup7dJ5-UM794sA-9WD21ge-VHYzBGb-E9PA_h0",
        amountAtomic: "1000000",
        invoice: "rgb:test",
        recipientId: "sbc:wvout:test",
        expirationTimestamp: Date.now() / 1000 + 3600,
        status: body ? "awaiting_payment" : "settled",
        txid: "b".repeat(64),
      });
    },
  });
  cleanup.push(() => stakes.close());
  const app = createApp({ databasePath, stakeDeposits: stakes });
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
        template: "wake_up",
        title: "Wake up",
        successRule: "Answer a fresh problem during the window",
        proofMethod: "timed_math",
        proofSource: "Server response and timestamp",
        timezone: "Europe/Rome",
        bettingCutoff: new Date(starts - 60000).toISOString(),
        startsAt: new Date(starts).toISOString(),
        proofDeadline: new Date(deadline).toISOString(),
        creatorStakeAtomic: "1000000",
      })
  ).body.challenge;
  const base = "/api/challenges/" + challenge.id;
  const post = (suffix: string, body: unknown, token = a.token) =>
    request(app)
      .post(base + suffix)
      .set("Authorization", `Bearer ${token}`)
      .send(body);
  await post("/creator-deposit", {});
  await request(app)
    .get(base + "/creator-deposit")
    .set("Authorization", `Bearer ${a.token}`);
  await post("/publish", {});
  const time = (value: number) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(value);
  };
  return { app, databasePath, a, b, base, post, starts, deadline, time };
}
function answer(problem: { left: number; right: number }) {
  return String(problem.left + problem.right);
}
it("only the creator can get a fresh problem within the saved window", async () => {
  const f = await setup();
  expect((await f.post("/math/problem", {})).status).toBe(409);
  f.time(f.starts);
  expect((await f.post("/math/problem", {}, f.b.token)).status).toBe(404);
  const created = await f.post("/math/problem", {});
  expect(created.status).toBe(200);
  expect(created.body.problem.answer).toBeUndefined();
  expect(created.body.problem.id).toBeTruthy();
  expect((await f.post("/math/problem", {})).body).toEqual(created.body);
  f.time(f.deadline);
  expect((await f.post("/math/problem", {})).status).toBe(409);
});
it("accepts the exact answer with a server timestamp and returns the same receipt on retries", async () => {
  const f = await setup();
  f.time(f.starts);
  const problem = (await f.post("/math/problem", {})).body.problem;
  const body = { problemId: problem.id, answer: answer(problem) };
  const accepted = await f.post("/math/submit", body);
  expect(accepted.status).toBe(200);
  expect(accepted.body.proof.status).toBe("accepted");
  expect(accepted.body.proof.submittedAt).toBe(new Date(f.starts).toISOString());
  expect((await f.post("/math/submit", body)).body).toEqual(accepted.body);
  expect((await f.post("/math/submit", { ...body, answer: "0" })).status).toBe(409);
  const second = createApp({ databasePath: f.databasePath });
  cleanup.push(() => second.locals.close());
  const retry = await request(second)
    .post(f.base + "/math/submit")
    .set("Authorization", `Bearer ${f.a.token}`)
    .send(body);
  expect(retry.body).toEqual(accepted.body);
  expect(
    (
      await request(second)
        .get(f.base + "/proofs")
        .set("Authorization", `Bearer ${f.a.token}`)
    ).body.proofs,
  ).toHaveLength(1);
});
it("rejects wrong answers once and allows another fresh problem before the deadline", async () => {
  const f = await setup();
  f.time(f.starts);
  const first = (await f.post("/math/problem", {})).body.problem;
  const bad = await f.post("/math/submit", { problemId: first.id, answer: "0" });
  expect(bad.body.proof.status).toBe("rejected");
  const second = (await f.post("/math/problem", {})).body.problem;
  expect(second.id).not.toBe(first.id);
  expect(
    (await f.post("/math/submit", { problemId: second.id, answer: answer(second) })).body
      .proof.status,
  ).toBe("accepted");
  expect((await f.post("/math/problem", {})).status).toBe(409);
});
it("rejects late submissions, invented problems, and client-supplied times or verdicts", async () => {
  const f = await setup();
  f.time(f.starts);
  const problem = (await f.post("/math/problem", {})).body.problem;
  expect(
    (
      await f.post("/math/submit", {
        problemId: problem.id,
        answer: answer(problem),
        submittedAt: new Date(f.starts).toISOString(),
      })
    ).status,
  ).toBe(400);
  expect(
    (await f.post("/math/submit", { problemId: "invented", answer: "25" })).status,
  ).toBe(404);
  expect(
    (
      await f.post(
        "/math/submit",
        { problemId: problem.id, answer: answer(problem) },
        f.b.token,
      )
    ).status,
  ).toBe(404);
  f.time(f.deadline);
  expect(
    (await f.post("/math/submit", { problemId: problem.id, answer: answer(problem) }))
      .status,
  ).toBe(409);
});
it("does not accept another problem after restart and returns old receipts after deadline without a new attempt", async () => {
  const f = await setup();
  f.time(f.starts);
  const problem = (await f.post("/math/problem", {})).body.problem;
  const body = { problemId: problem.id, answer: answer(problem) };
  const saved = await f.post("/math/submit", body);
  f.time(f.deadline + 1000);
  expect((await f.post("/math/submit", body)).body).toEqual(saved.body);
  expect(
    (
      await request(f.app)
        .get(f.base + "/proofs")
        .set("Authorization", `Bearer ${f.b.token}`)
    ).status,
  ).toBe(404);
});
it("checks the persisted deadline at the database write boundary", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  const { mathProofs } = await import("../src/store/math-proofs.js");
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE challenges(id TEXT PRIMARY KEY,result TEXT NOT NULL)");
  db.prepare("INSERT INTO challenges VALUES(?,?)").run(
    "challenge",
    JSON.stringify({
      startsAt: new Date(1000).toISOString(),
      proofDeadline: new Date(2000).toISOString(),
    }),
  );
  let now = 1500;
  const proofs = mathProofs(db, () => now);
  try {
    const problem = proofs.createMathProblem("challenge");
    now = 2000;
    expect(() => proofs.submitMath("challenge", problem.id, answer(problem))).toThrow(
      "proof window",
    );
    expect(proofs.listMathProofs("challenge")).toEqual([]);
  } finally {
    db.close();
  }
});
