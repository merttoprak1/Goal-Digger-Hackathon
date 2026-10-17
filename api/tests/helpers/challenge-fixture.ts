import { afterEach, vi } from "vitest";
import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { vaultPayouts } from "../../src/services/vault-payouts.js";
import { createApp } from "../../src/app.js";
import { openStakeDeposits } from "../../../vault/stake-deposits.mjs";
export const cleanup: Array<() => void> = [];
afterEach(() => {
  vi.useRealTimers();
  for (const f of cleanup.splice(0).reverse()) f();
});
export async function setup(template = "wake_up", creatorStakeAtomic = "5000000") {
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
  const remote = new Map<string, Record<string, unknown>>();
  const calls: Array<{ path: string; body: Record<string, unknown> }> = [];
  const control = {
    lost: false,
    mismatch: false,
    reject: false,
    sameRecipient: false,
    duringValidation: () => {},
    sends: 0,
    executionLost: false,
    executionUnknown: false,
    executionMismatch: false,
    executionReject: false,
    duringExecution: () => {},
  };
  const executions = new Map<string, Record<string, unknown>>();
  const payoutVault = vaultPayouts("private-test-token", async (url, init) => {
    const path = String(url);
    const body = JSON.parse(String(init?.body));
    calls.push({ path, body });
    if (path.endsWith("/execute")) {
      const id = path.split("/").at(-2)!;
      const saved = remote.get(id)!;
      if (!executions.has(id)) {
        if (control.executionReject)
          return Response.json({ valid: false }, { status: 422 });
        executions.set(id, {
          ...saved,
          status: "unknown",
          txid: null,
          attemptedAt: new Date().toISOString(),
        });
        control.sends++;
        control.duringExecution();
        if (!control.executionUnknown)
          executions.set(id, {
            ...executions.get(id),
            status: "accepted",
            txid: "b".repeat(64),
          });
      }
      if (control.executionLost) throw new Error("Execution response lost");
      const receipt = executions.get(id)!;
      return Response.json(
        { ...receipt, ...(control.executionMismatch ? { participantId: "wrong" } : {}) },
        { status: receipt.status === "accepted" ? 200 : 409 },
      );
    }
    if (path.endsWith("/validate")) {
      control.duringValidation();
      if (control.reject) return Response.json({ valid: false }, { status: 422 });
      return Response.json({
        valid: true,
        network: "SignetCustom",
        assetId: "rgb:lX~ToKsO-Iup7dJ5-UM794sA-9WD21ge-VHYzBGb-E9PA_h0",
        amountAtomic: body.amountAtomic,
        recipientId: "sbc:wvout:" + (control.sameRecipient ? "same" : body.invoice),
        expirationTimestamp: Math.floor(Date.now() / 1000) + 3600,
      });
    }
    if (!path.endsWith("/vault/payouts")) throw new Error("Unexpected vault operation");
    if (!remote.has(body.payoutId))
      remote.set(body.payoutId, {
        ...body,
        assetId: "rgb:lX~ToKsO-Iup7dJ5-UM794sA-9WD21ge-VHYzBGb-E9PA_h0",
        recipientId: "sbc:wvout:" + (control.sameRecipient ? "same" : body.invoice),
        expirationTimestamp: Math.floor(Date.now() / 1000) + 3600,
        status: "prepared",
        createdAt: new Date().toISOString(),
      });
    if (control.lost) throw new Error("Response lost after saving");
    return Response.json({
      ...remote.get(body.payoutId),
      ...(control.mismatch ? { amountAtomic: "1" } : {}),
    });
  });
  const app = createApp({ databasePath, stakeDeposits: stakes, payoutVault });
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
        creatorStakeAtomic,
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
    payoutVault,
    remote,
    calls,
    control,
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
export async function finish(f: Awaited<ReturnType<typeof setup>>, success = false) {
  await f.opponent();
  if (success) {
    f.time(f.starts);
    const p = (await f.post("/math/problem")).body.problem;
    await f.post("/math/submit", { problemId: p.id, answer: String(p.left + p.right) });
  }
  f.time(f.deadline);
  await f.post("/finalize");
  await f.post("/payout-plan");
}
