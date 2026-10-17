import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createVaultServer } from "../vault/vault.mjs";
const assetId = "rgb:lX~ToKsO-Iup7dJ5-UM794sA-9WD21ge-VHYzBGb-E9PA_h0";
const txid = "d".repeat(64);
const input = {
  payoutId: "award-1",
  challengeId: "challenge-1",
  participantId: "creator-1",
  amountAtomic: "1000000",
  invoice: "rgb:test",
};
const transfer = {
  kind: "Send",
  recipientId: "sbc:wvout:recipient",
  requestedAssignment: { Fungible: 1000000 },
  assignments: [],
  txid,
  status: "Settled",
};
const decodeInvoice = async () => ({
  network: "SignetCustom",
  assetSchema: "Nia",
  assetId,
  recipientId: transfer.recipientId,
  assignment: { Fungible: 1000000 },
  expirationTimestamp: Math.floor(Date.now() / 1000) + 3600,
  transportEndpoints: ["rpcs://proxy.iriswallet.com/0.2/json-rpc"],
});
async function fixture(t, options = {}) {
  const dir = mkdtempSync(join(tmpdir(), "payout-settlement-"));
  let snapshot = { assetId, transfers: [transfer] };
  let offline = false,
    reads = 0,
    sends = 0;
  const app = createVaultServer({
    token: "secret",
    databasePath: join(dir, "vault.sqlite"),
    decodeInvoice,
    executePayout: async () => {
      sends++;
      if (options.uncertain) throw Error("timeout");
      return { txid };
    },
    readPayout: async (saved) => {
      reads++;
      assert.equal(saved.txid, txid);
      if (offline) throw Error("unavailable");
      return snapshot;
    },
  });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise((resolve) => app.server.close(resolve));
    app.close();
    rmSync(dir, { recursive: true });
  });
  const url = `http://127.0.0.1:${app.server.address().port}/vault/payouts`;
  const request = (suffix, body) =>
    fetch(url + suffix, {
      method: "POST",
      headers: { authorization: "Bearer secret", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  return {
    save: () => request("", input),
    execute: () => request("/award-1/execute", {}),
    status: (id = "award-1", token = "secret") =>
      fetch(`${url}/${id}/status`, { headers: { authorization: `Bearer ${token}` } }),
    get: () => fetch(`${url}/award-1`, { headers: { authorization: "Bearer secret" } }),
    set: (next) => {
      snapshot = next;
    },
    offline: (value) => {
      offline = value;
    },
    counts: () => ({ reads, sends }),
  };
}

test("settlement lookup is private and does not inspect prepared or uncertain payouts", async (t) => {
  for (const uncertain of [false, true]) {
    const f = await fixture(t, { uncertain });
    assert.equal((await f.status("award-1", "wrong")).status, 401);
    assert.equal((await f.status()).status, 404);
    await f.save();
    assert.equal((await (await f.status()).json()).status, "prepared");
    if (uncertain) {
      await f.execute();
      assert.equal((await (await f.status()).json()).status, "unknown");
    }
    assert.equal(f.counts().reads, 0);
    assert.equal(f.counts().sends, uncertain ? 1 : 0);
  }
});

test("settlement follows the exact outgoing transfer and preserves the accepted execution record", async (t) => {
  const f = await fixture(t);
  await f.save();
  await f.execute();
  for (const [native, expected] of [
    ["WaitingCounterparty", "pending"],
    ["WaitingBroadcast", "pending"],
    ["WaitingConfirmations", "pending"],
    ["Settled", "settled"],
    ["Failed", "failed"],
  ]) {
    f.set({ assetId, transfers: [{ ...transfer, status: native }] });
    const r = await f.status();
    assert.equal(r.status, 200);
    const result = await r.json();
    assert.equal(result.status, expected);
    assert.equal(result.txid, txid);
    assert.equal(result.executionStatus, "accepted");
    assert.ok(result.checkedAt);
    const stored = await (await f.get()).json();
    assert.equal(stored.status, "accepted");
    assert.equal(stored.settlement.status, expected);
    assert.equal((await (await f.execute()).json()).txid, txid);
  }
  assert.equal(f.counts().sends, 1);
});

test("missing or conflicting payout history cannot report settlement", async (t) => {
  const f = await fixture(t);
  await f.save();
  await f.execute();
  const scenarios = [
    [{ assetId: "rgb:other", transfers: [transfer] }, "unknown"],
    [{ assetId, transfers: [] }, "unknown"],
    [{ assetId, transfers: [{ ...transfer, kind: "ReceiveWitness" }] }, "unknown"],
    [
      { assetId, transfers: [{ ...transfer, recipientId: "sbc:wvout:other" }] },
      "unknown",
    ],
    [{ assetId, transfers: [transfer, transfer] }, "review_required"],
    ...[
      { txid: "a".repeat(64) },
      { txid: null },
      { requestedAssignment: { Fungible: 999999 } },
      { requestedAssignment: null },
      { requestedAssignment: { Fungible: 1000000, Other: 1 } },
    ].map((change) => [
      { assetId, transfers: [{ ...transfer, ...change }] },
      "review_required",
    ]),
  ];
  for (const [snapshot, expected] of scenarios) {
    f.set(snapshot);
    assert.equal((await (await f.status()).json()).status, expected);
  }
  assert.equal(f.counts().sends, 1);
});

test("status always refreshes and an outage does not return cached settlement or resend", async (t) => {
  const f = await fixture(t);
  await f.save();
  await f.execute();
  assert.equal((await (await f.status()).json()).status, "settled");
  f.offline(true);
  assert.equal((await f.status()).status, 503);
  assert.equal((await (await f.get()).json()).settlement.status, "settled");
  f.offline(false);
  f.set({ assetId, transfers: [{ ...transfer, status: "WaitingConfirmations" }] });
  assert.equal((await (await f.status()).json()).status, "pending");
  assert.equal(f.counts().reads, 3);
  assert.equal(f.counts().sends, 1);
});
