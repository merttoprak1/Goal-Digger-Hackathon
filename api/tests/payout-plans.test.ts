import { afterEach, it, expect, vi } from "vitest";
import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { allocatePool } from "../src/store/payout-plans.js";
import type { BettingSnapshot } from "../src/store/betting.js";
import { createApp } from "../src/app.js";
import { openStakeDeposits } from "../../vault/stake-deposits.mjs";
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
        template,
        title: "Wake up",
        successRule: "Solve the fresh problem",
        proofMethod: template === "wake_up" ? "timed_math" : "official_result",
        proofSource: "Server response and timestamp",
        timezone: "Europe/Rome",
        bettingCutoff: new Date(starts - 60000).toISOString(),
        startsAt: new Date(starts).toISOString(),
        proofDeadline: new Date(deadline).toISOString(),
        creatorStakeAtomic: "5000000",
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
  const opponent = async (amountAtomic = "5000000", token = b.token) => {
    await post("/opponent-deposit", { amountAtomic }, token);
    await get("/opponent-deposit", token);
  };
  const c = (await request(app).post("/api/sessions").send({ displayName: "Vesim" }))
    .body;
  const time = (t: number) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(t);
  };
  return {
    app,
    databasePath,
    a,
    b,
    c,
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
  };
}
it("fixes exact opponent shares at the cutoff and keeps them across retries and restart", async () => {
  const f = await setup();
  await f.opponent();
  await f.opponent("10000000", f.c.token);
  expect((await f.get("/betting-snapshot")).body.snapshot).toBeNull();
  expect((await f.post("/close-betting")).status).toBe(409);
  f.time(f.starts - 60000);
  expect((await f.post("/close-betting", { shares: [] })).status).toBe(400);
  const result = await f.post("/close-betting");
  expect(result.status).toBe(200);
  const snapshot = result.body.snapshot;
  expect(snapshot).toMatchObject({
    poolAtomic: "20000000",
    opponentTotalAtomic: "15000000",
  });
  expect(snapshot.shares).toEqual(
    expect.arrayContaining([
      {
        participantId: f.b.participant.id,
        stakeAtomic: "5000000",
        numerator: "5000000",
        denominator: "15000000",
      },
      {
        participantId: f.c.participant.id,
        stakeAtomic: "10000000",
        numerator: "10000000",
        denominator: "15000000",
      },
    ]),
  );
  expect((await f.post("/opponent-deposit", { amountAtomic: "1" })).status).toBe(409);
  f.time(f.starts);
  expect((await f.post("/close-betting", {}, f.b.token)).body).toEqual(result.body);
  const app = createApp({ databasePath: f.databasePath });
  cleanup.push(() => app.locals.close());
  expect(
    (
      await request(app)
        .get(f.base + "/betting-snapshot")
        .set("Authorization", `Bearer ${f.c.token}`)
    ).body,
  ).toEqual(result.body);
});
it("allocates the whole pool by the saved opponent shares after failure", async () => {
  const f = await setup();
  await f.opponent();
  await f.opponent("10000000", f.c.token);
  f.time(f.deadline);
  expect((await f.post("/payout-plan")).status).toBe(409);
  expect((await f.post("/finalize")).status).toBe(200);
  const result = await f.post("/payout-plan");
  expect(result.status).toBe(200);
  expect(result.body.plan.allocations).toEqual(
    expect.arrayContaining([
      { participantId: f.b.participant.id, amountAtomic: "6666667" },
      { participantId: f.c.participant.id, amountAtomic: "13333333" },
    ]),
  );
  expect(
    result.body.plan.allocations.reduce(
      (sum: bigint, r: { amountAtomic: string }) => sum + BigInt(r.amountAtomic),
      0n,
    ),
  ).toBe(20000000n);
  expect((await f.post("/payout-plan", {}, f.b.token)).body).toEqual(result.body);
  const app = createApp({ databasePath: f.databasePath });
  cleanup.push(() => app.locals.close());
  expect(
    (
      await request(app)
        .post(f.base + "/payout-plan")
        .set("Authorization", `Bearer ${f.c.token}`)
        .send({})
    ).body,
  ).toEqual(result.body);
});
it("allocates the whole pool to the creator after success", async () => {
  const f = await setup();
  await f.opponent();
  await f.opponent("10000000", f.c.token);
  f.time(f.starts);
  const problem = (await f.post("/math/problem")).body.problem;
  await f.post("/math/submit", {
    problemId: problem.id,
    answer: String(problem.left + problem.right),
  });
  f.time(f.deadline);
  await f.post("/finalize");
  const result = await f.post("/payout-plan");
  expect(result.body.plan).toMatchObject({
    outcome: "success",
    poolAtomic: "20000000",
    allocations: [{ participantId: f.a.participant.id, amountAtomic: "20000000" }],
  });
});
it("holds the snapshot for no opponents, pending funds, and late credits", async () => {
  const f = await setup();
  f.time(f.starts - 60000);
  expect((await f.post("/close-betting")).status).toBe(409);
  f.time(f.starts - 120000);
  f.set(false);
  await f.opponent();
  f.time(f.starts - 60000);
  expect((await f.post("/close-betting")).status).toBe(409);
  f.set(true);
  await f.get("/opponent-deposit", f.b.token);
  expect((await f.post("/close-betting")).status).toBe(409);
  expect((await f.get("/betting-snapshot")).body.snapshot).toBeNull();
});
it("blocks a new or existing payout plan when the current ledger no longer matches the snapshot", async () => {
  const f = await setup();
  await f.opponent();
  f.time(f.starts - 60000);
  await f.post("/close-betting");
  f.time(f.deadline);
  await f.post("/finalize");
  const saved = (await f.post("/payout-plan")).body;
  const db = new DatabaseSync(f.databasePath);
  db.prepare("UPDATE stake_deposits SET amount=? WHERE participant_id=?").run(
    "6000000",
    f.b.participant.id,
  );
  db.prepare("UPDATE opponent_stakes SET amount=? WHERE participant_id=?").run(
    "6000000",
    f.b.participant.id,
  );
  db.close();
  expect((await f.post("/payout-plan")).status).toBe(409);
  expect((await f.get("/payout-plan")).body).toEqual(saved);
  expect((await f.post("/close-betting")).status).toBe(409);
});
it("requires a session, a published challenge, and empty request bodies", async () => {
  const f = await setup();
  for (const path of ["/close-betting", "/payout-plan"]) {
    expect(
      (
        await request(f.app)
          .post(f.base + path)
          .send({})
      ).status,
    ).toBe(401);
    expect(
      (
        await request(f.app)
          .post("/api/challenges/missing" + path)
          .set("Authorization", `Bearer ${f.a.token}`)
          .send({})
      ).status,
    ).toBe(404);
    expect((await f.post(path, { poolAtomic: "1" })).status).toBe(400);
  }
  for (const path of ["/betting-snapshot", "/payout-plan"])
    expect((await request(f.app).get(f.base + path)).status).toBe(401);
});
it("uses largest remainders and stable participant IDs for atomic rounding ties", () => {
  const snapshot = {
    creatorId: "creator",
    poolAtomic: "10",
    opponentTotalAtomic: "3",
    shares: ["c", "b", "a"].map((participantId) => ({
      participantId,
      stakeAtomic: "1",
      numerator: "1",
      denominator: "3",
    })),
  } as BettingSnapshot;
  expect(allocatePool(snapshot, "failure")).toEqual([
    { participantId: "a", amountAtomic: "4" },
    { participantId: "b", amountAtomic: "3" },
    { participantId: "c", amountAtomic: "3" },
  ]);
  snapshot.poolAtomic = "90071992547409930000001";
  const result = allocatePool(snapshot, "failure");
  expect(result.reduce((sum, r) => sum + BigInt(r.amountAtomic), 0n)).toBe(
    BigInt(snapshot.poolAtomic),
  );
  expect(result[0]!.amountAtomic).toBe("30023997515803310000001");
});
