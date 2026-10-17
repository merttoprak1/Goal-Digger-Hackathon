import { test } from "node:test";
import assert from "node:assert/strict";
import { executePayoutTransfer } from "./payout-transfer.mjs";
const assetId = "rgb:lX~ToKsO-Iup7dJ5-UM794sA-9WD21ge-VHYzBGb-E9PA_h0";
const saved = () => ({
  payoutId: "award-1",
  invoice: "rgb:test",
  assetId,
  recipientId: "sbc:wvout:recipient",
  amountAtomic: "1000000",
  status: "prepared",
});
const decoded = () => ({
  network: "SignetCustom",
  assetSchema: "Nia",
  assetId,
  recipientId: "sbc:wvout:recipient",
  assignment: { Fungible: 1000000 },
  expirationTimestamp: Math.floor(Date.now() / 1000) + 3600,
  transportEndpoints: ["rpcs://proxy.iriswallet.com/0.2/json-rpc"],
});
const txid = "c".repeat(64);
function fixture(change = {}) {
  const journal = [];
  const calls = [];
  const account = {
    decodeRGBInvoice: async () => decoded(),
    refreshWallet: async () => {},
    getAssetBalance: async () => ({ settled: 1000000, spendable: 1000000 }),
    listTransfers: async () => [],
    transfer: async (args) => {
      calls.push(args);
      assert.equal(journal.at(-1).status, "unknown");
      return { hash: txid, fee: 414n };
    },
    ...change,
  };
  return {
    account,
    journal,
    calls,
    saveRecord: (record) => journal.push(structuredClone(record)),
  };
}
test("native payout signs the saved amount and recipient only after saving uncertainty", async () => {
  const f = fixture();
  const result = await executePayoutTransfer({ ...f, saved: saved() });
  assert.deepEqual(f.calls, [
    {
      token: assetId,
      recipient: "rgb:test",
      amount: 1000000,
      feeRate: 1,
      minConfirmations: 1,
      witnessData: { amountSat: 1000, blinding: 0 },
    },
  ]);
  assert.deepEqual(
    f.journal.map((r) => r.status),
    ["unknown", "accepted"],
  );
  assert.equal(result.txid, txid);
  assert.equal(result.estimatedFeeSat, "414");
});
test("native payout rejects expired, changed, or unsupported invoices before transfer", async () => {
  for (const change of [
    { recipientId: "sbc:wvout:other" },
    { assetId: "rgb:other" },
    { assignment: { Fungible: 2 } },
    { expirationTimestamp: 1 },
    { network: "Signet" },
  ]) {
    const f = fixture({ decodeRGBInvoice: async () => ({ ...decoded(), ...change }) });
    await assert.rejects(executePayoutTransfer({ ...f, saved: saved() }));
    assert.equal(f.calls.length, 0);
    assert.equal(f.journal.length, 0);
  }
});
test("native payout rejects insufficient spendable assets and a previously used sender recipient", async () => {
  for (const change of [
    { getAssetBalance: async () => ({ settled: 1000000, spendable: 0 }) },
    { getAssetBalance: async () => ({ settled: 0, spendable: 1000000 }) },
    {
      listTransfers: async () => [
        { kind: "Send", recipientId: saved().recipientId, status: "Settled" },
      ],
    },
    { listTransfers: async () => null },
  ]) {
    const f = fixture(change);
    await assert.rejects(executePayoutTransfer({ ...f, saved: saved() }));
    assert.equal(f.calls.length, 0);
    assert.equal(f.journal.length, 0);
  }
});
test("an uncertain native send stays blocked, including malformed transaction results", async () => {
  for (const transfer of [
    async () => {
      throw Error("timeout");
    },
    async () => ({ hash: "invalid", fee: 1n }),
  ]) {
    const f = fixture({ transfer });
    const record = saved();
    await assert.rejects(executePayoutTransfer({ ...f, saved: record }));
    assert.equal(f.journal.at(-1).status, "unknown");
    await assert.rejects(executePayoutTransfer({ ...f, saved: f.journal.at(-1) }));
    assert.equal(f.journal.length, 1);
  }
});
