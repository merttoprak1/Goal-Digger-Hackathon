import { afterEach, it, expect, vi } from "vitest";
import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../src/app.js";
import { openStakeDeposits } from "../../vault/stake-deposits.mjs";
const cleanup: Array<() => void> = [];
afterEach(() => {
  vi.useRealTimers();
  for (const f of cleanup.splice(0).reverse()) f();
});
async function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "challenge-funding-"));
  cleanup.push(() => rmSync(dir, { recursive: true }));
  let status = "awaiting_payment";
  let offline = false;
  let calls = 0;
  const databasePath = join(dir, "api.sqlite");
  const stakes = openStakeDeposits({
    databasePath,
    token: "secret",
    fetchService: async (_url, init) => {
      calls++;
      if (offline) throw Error("offline");
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      return Response.json({
        paymentId: body?.paymentId ?? paymentId,
        assetId: "rgb:lX~ToKsO-Iup7dJ5-UM794sA-9WD21ge-VHYzBGb-E9PA_h0",
        amountAtomic: "1000000",
        invoice: "rgb:test",
        recipientId: "sbc:wvout:test",
        expirationTimestamp: Date.now() / 1000 + 3600,
        status: body ? "awaiting_payment" : status,
        txid: "a".repeat(64),
      });
    },
  });
  cleanup.push(() => stakes.close());
  const app = createApp({ databasePath, stakeDeposits: stakes });
  cleanup.push(() => app.locals.sessionStore.close());
  const a = (await request(app).post("/api/sessions").send({ displayName: "Mert" })).body;
  const b = (await request(app).post("/api/sessions").send({ displayName: "Ege" })).body;
  const start = Date.now() + 3600000;
  const input = {
    template: "wake_up",
    title: "Wake up",
    successRule: "Solve a timed math problem",
    proofMethod: "timed_math",
    proofSource: "Server answer and timestamp",
    timezone: "Europe/Rome",
    bettingCutoff: new Date(start - 60000).toISOString(),
    startsAt: new Date(start).toISOString(),
    proofDeadline: new Date(start + 60000).toISOString(),
    creatorStakeAtomic: "1000000",
  };
  const challenge = (
    await request(app)
      .post("/api/challenges")
      .set("Authorization", `Bearer ${a.token}`)
      .send(input)
  ).body.challenge;
  const paymentId = `creator-${challenge.id}`;
  const path = `/api/challenges/${challenge.id}/creator-deposit`;
  return {
    app,
    a,
    b,
    challenge,
    stakes,
    path,
    databasePath,
    set: (s: string) => {
      status = s;
    },
    offline: () => {
      offline = true;
    },
    calls: () => calls,
  };
}
it("funding uses only the owner and saved amount with one stable invoice on retries", async () => {
  const f = await fixture();
  expect((await request(f.app).post(f.path).send({})).status).toBe(401);
  expect(
    (
      await request(f.app)
        .post(f.path)
        .set("Authorization", `Bearer ${f.b.token}`)
        .send({})
    ).status,
  ).toBe(404);
  expect(
    (
      await request(f.app)
        .post(f.path)
        .set("Authorization", `Bearer ${f.a.token}`)
        .send({ amountAtomic: "2" })
    ).status,
  ).toBe(400);
  const first = await request(f.app)
    .post(f.path)
    .set("Authorization", `Bearer ${f.a.token}`)
    .send({});
  expect(first.status).toBe(200);
  expect(first.body.amountAtomic).toBe("1000000");
  const second = await request(f.app)
    .post(f.path)
    .set("Authorization", `Bearer ${f.a.token}`)
    .send({});
  expect(second.body).toEqual(first.body);
  expect(f.calls()).toBe(1);
});
it("pending deposits do not fund a challenge and settled deposits credit exactly once", async () => {
  const f = await fixture();
  const auth = `Bearer ${f.a.token}`;
  await request(f.app).post(f.path).set("Authorization", auth).send({});
  expect((await request(f.app).get(f.path).set("Authorization", auth)).body.status).toBe(
    "awaiting_payment",
  );
  f.set("pending");
  expect(
    (await request(f.app).get(f.path).set("Authorization", auth)).body
      .confirmedPoolAtomic,
  ).toBe("0");
  f.set("settled");
  const settled = await request(f.app).get(f.path).set("Authorization", auth);
  expect(settled.body.status).toBe("credited");
  expect(settled.body.confirmedPoolAtomic).toBe("1000000");
  const again = await request(f.app).get(f.path).set("Authorization", auth);
  expect(again.body.confirmedPoolAtomic).toBe("1000000");
  expect(f.stakes.listCredits(f.challenge.id)).toHaveLength(1);
  const detail = await request(f.app)
    .get("/api/challenges/" + f.challenge.id)
    .set("Authorization", auth);
  expect(detail.body.challenge.confirmedPoolAtomic).toBe("1000000");
  expect(detail.body.challenge.status).toBe("funded");
});
it("vault outages never turn into funding or loss", async () => {
  const f = await fixture();
  f.offline();
  const r = await request(f.app)
    .post(f.path)
    .set("Authorization", `Bearer ${f.a.token}`)
    .send({});
  expect(r.status).toBe(503);
  expect(f.stakes.listCredits(f.challenge.id)).toEqual([]);
});

it("blocks new invoices after cutoff and records late funds for review", async () => {
  const f = await fixture();
  const auth = `Bearer ${f.a.token}`;
  expect((await request(f.app).get(f.path).set("Authorization", auth)).status).toBe(409);
  await request(f.app).post(f.path).set("Authorization", auth).send({});
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(Date.parse(f.challenge.bettingCutoff) + 1000));
  f.set("settled");
  const result = await request(f.app).get(f.path).set("Authorization", auth);
  expect(result.body.status).toBe("review_required");
  expect(result.body.eligibleToOpen).toBe(false);
  expect(result.body.confirmedPoolAtomic).toBe("1000000");
  const detail = await request(f.app)
    .get("/api/challenges/" + f.challenge.id)
    .set("Authorization", auth);
  expect(detail.body.challenge.status).toBe("funding_review");
});
it("preserves confirmed pool after restart even when the vault token is unavailable", async () => {
  const f = await fixture();
  const auth = `Bearer ${f.a.token}`;
  await request(f.app).post(f.path).set("Authorization", auth).send({});
  f.set("settled");
  await request(f.app).get(f.path).set("Authorization", auth);
  const second = createApp({ databasePath: f.databasePath });
  cleanup.push(() => second.locals.close());
  const detail = await request(second)
    .get("/api/challenges/" + f.challenge.id)
    .set("Authorization", auth);
  expect(detail.body.challenge.confirmedPoolAtomic).toBe("1000000");
  expect(detail.body.challenge.status).toBe("funded");
});
it("rejects creating a first invoice once betting closes", async () => {
  const f = await fixture();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(Date.parse(f.challenge.bettingCutoff) + 1000));
  expect(
    (
      await request(f.app)
        .post(f.path)
        .set("Authorization", `Bearer ${f.a.token}`)
        .send({})
    ).status,
  ).toBe(409);
  expect(f.calls()).toBe(0);
});
