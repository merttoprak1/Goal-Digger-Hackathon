import { test } from "node:test";
import assert from "node:assert/strict";
import * as wallet from "../app/lib/wallet.ts";

const invoice = "rgb:mutinynet-test-invoice";
function setup() {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  const calls: string[] = [];
  const provider = {
    enable: async () => { calls.push("enable"); },
    getInfo: async () => ({ ready: true, network: "signet", protocol: "RGB_L1", methods: ["sendAsset"] }),
    listAssets: async () => [],
    sendAsset: async (args: { invoice: string }) => {
      assert.deepEqual(args, { invoice });
      calls.push("sendAsset");
      return { txid: "ab".repeat(32) };
    },
  };
  return { storage, calls, provider };
}

test("stake invoice opens wallet approval and is not sent twice after success", async () => {
  const { storage, calls, provider } = setup();
  assert.equal(typeof wallet.requestStakePayment, "function");
  await wallet.requestStakePayment(invoice, storage, provider);
  await assert.rejects(wallet.requestStakePayment(invoice, storage, provider), /Check payment/);
  assert.deepEqual(calls, ["enable", "sendAsset"]);
});

test("wallet rejection allows an explicit retry of the same invoice", async () => {
  const { storage, provider } = setup();
  await assert.rejects(wallet.requestStakePayment(invoice, storage, {
    ...provider,
    sendAsset: async () => { throw Object.assign(Error("Rejected"), { code: "USER_REJECTED" }); },
  }), /cancelled/);
  await wallet.requestStakePayment(invoice, storage, provider);
});

test("uncertain send failures block resubmission", async () => {
  const { storage, provider } = setup();
  await assert.rejects(wallet.requestStakePayment(invoice, storage, {
    ...provider,
    sendAsset: async () => { throw Error("Connection lost"); },
  }), /Check payment/);
  await assert.rejects(wallet.requestStakePayment(invoice, storage, provider), /Check payment/);
});

test("concurrent requests produce one wallet send", async () => {
  const { storage, provider, calls } = setup();
  const results = await Promise.allSettled([
    wallet.requestStakePayment(invoice, storage, provider),
    wallet.requestStakePayment(invoice, storage, provider),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(calls.filter((c) => c === "sendAsset").length, 1);
});

test("missing or unsupported wallets do not send", async () => {
  const { storage, provider, calls } = setup();
  await assert.rejects(wallet.requestStakePayment(invoice, storage), /KaleidoSwap/);
  for (const info of [
    { ready: false, network: "signet", protocol: "RGB_L1", methods: ["sendAsset"] },
    { ready: true, network: "bitcoin", protocol: "RGB_L1", methods: ["sendAsset"] },
    { ready: true, network: "signet", protocol: "RGB_LN", methods: ["sendAsset"] },
    { ready: true, network: "signet", protocol: "RGB_L1", methods: [] },
  ]) {
    await assert.rejects(wallet.requestStakePayment(invoice, storage, { ...provider, getInfo: async () => info }));
  }
  assert.equal(calls.includes("sendAsset"), false);
});

for (const role of ["creator", "opponent"]) {
  test(`${role} invoice creation checks receipt then requests wallet payment`, async () => {
    const { storage, provider, calls } = setup();
    const shown: string[] = [];
    assert.equal(typeof wallet.createAndPayStake, "function");
    const note = await wallet.createAndPayStake({
      createInvoice: async () => { calls.push(role); return { invoice, status: "created" }; },
      checkPayment: async () => { calls.push("check"); return { status: "awaiting_payment" }; },
      onInvoice: (value: { invoice: string }) => { shown.push(value.invoice); },
      storage, provider,
    });
    assert.deepEqual(calls, [role, "check", "enable", "sendAsset"]);
    assert.deepEqual(shown, [invoice]);
    assert.match(note, /confirmation/);
  });
}

test("existing paid or uncertain receipts never open payment approval", async () => {
  for (const status of ["credited", "pending", "unknown", "review_required", "failed"]) {
    const { storage, provider, calls } = setup();
    const request = wallet.createAndPayStake({
      createInvoice: async () => ({ invoice, status: "created" }),
      checkPayment: async () => ({ status }), storage, provider,
    });
    if (["unknown", "review_required", "failed"].includes(status)) await assert.rejects(request);
    else await request;
    assert.deepEqual(calls, []);
  }
});

test("a send without a transfer handle reports the missing result and does not send twice", async () => {
  const { storage, provider, calls } = setup();
  await assert.rejects(wallet.createAndPayStake({
    createInvoice: async () => ({ invoice, status: "created" }),
    checkPayment: async () => ({ status: "awaiting_payment" }),
    storage,
    provider: { ...provider, sendAsset: async () => { calls.push("sendAsset"); return {}; } },
  }), /no transaction or transfer ID/);
  await assert.rejects(wallet.createAndPayStake({
    createInvoice: async () => ({ invoice, status: "created" }),
    checkPayment: async () => ({ status: "awaiting_payment" }),
    storage,
    provider,
  }), /Check payment/);
  assert.equal(calls.filter((call) => call === "sendAsset").length, 1);
});

test("a missing Bitcoin slot without createUtxos stays retryable", async () => {
  const { storage, provider, calls } = setup();
  await assert.rejects(wallet.createAndPayStake({
    createInvoice: async () => ({ invoice, status: "created" }),
    checkPayment: async () => ({ status: "awaiting_payment" }),
    storage,
    provider: {
      ...provider,
      sendAsset: async () => {
        calls.push("sendAsset");
        throw Object.assign(Error("No UTXO"), { code: "NO_AVAILABLE_UTXOS" });
      },
    },
  }), /Bitcoin slot/);
  await wallet.createAndPayStake({
    createInvoice: async () => ({ invoice, status: "created" }),
    checkPayment: async () => ({ status: "awaiting_payment" }),
    storage,
    provider,
  });
  assert.equal(calls.filter((call) => call === "sendAsset").length, 2);
});

test("a wallet with no Bitcoin slot creates one and then sends", async () => {
  const { storage, calls, provider } = setup();
  let slots = false;
  await wallet.requestStakePayment(invoice, storage, {
    ...provider,
    getInfo: async () => ({
      ready: true,
      network: "signet",
      protocol: "RGB_L1",
      methods: ["sendAsset", "createUtxos"],
    }),
    createUtxos: async () => { slots = true; calls.push("createUtxos"); },
    sendAsset: async () => {
      calls.push("sendAsset");
      if (!slots) throw Object.assign(Error("No UTXO"), { code: "NO_AVAILABLE_UTXOS" });
      return { txid: "ab".repeat(32) };
    },
  });
  assert.deepEqual(calls.filter((call) => call !== "enable"), ["sendAsset", "createUtxos", "sendAsset"]);
});

test("zero colorable slots create one Bitcoin slot before the send", async () => {
  const { storage, calls, provider } = setup();
  await wallet.requestStakePayment(invoice, storage, {
    ...provider,
    getInfo: async () => ({
      ready: true,
      network: "signet",
      protocol: "RGB_L1",
      methods: ["sendAsset", "createUtxos", "getBtcBalance"],
    }),
    getBtcBalance: async () => {
      calls.push("getBtcBalance");
      return { freeColorableUtxos: 0 };
    },
    createUtxos: async () => { calls.push("createUtxos"); },
  });
  assert.deepEqual(
    calls.filter((call) => call !== "enable"),
    ["getBtcBalance", "createUtxos", "sendAsset"],
  );
});

test("a rejected Bitcoin slot does not lock the stake", async () => {
  const { storage, calls, provider } = setup();
  await assert.rejects(wallet.requestStakePayment(invoice, storage, {
    ...provider,
    getInfo: async () => ({
      ready: true,
      network: "signet",
      protocol: "RGB_L1",
      methods: ["sendAsset", "createUtxos"],
    }),
    createUtxos: async () => {
      calls.push("createUtxos");
      throw Object.assign(Error("Rejected"), { code: "USER_REJECTED" });
    },
    sendAsset: async () => {
      calls.push("sendAsset");
      throw Object.assign(Error("No UTXO"), { code: "NO_AVAILABLE_UTXOS" });
    },
  }), /cancelled/);
  await wallet.requestStakePayment(invoice, storage, provider);
  assert.equal(calls.filter((call) => call === "sendAsset").length, 2);
});

test("an uncertain send preserves its error and lock while the vault awaits payment", async () => {
  const { storage, provider, calls } = setup();
  await assert.rejects(wallet.createAndPayStake({
    createInvoice: async () => ({ invoice, status: "created" }),
    checkPayment: async () => ({ status: "awaiting_payment" }),
    storage,
    provider: { ...provider, sendAsset: async () => {
      calls.push("sendAsset");
      throw Error("Connection lost");
    } },
  }), /Connection lost/);
  assert.equal(storage.getItem(`goal-digger-stake-send:${invoice}`), "requested");
  await assert.rejects(wallet.requestStakePayment(invoice, storage, provider), /Check payment/);
  assert.equal(calls.filter((call) => call === "sendAsset").length, 1);
});

test("an uncertain send stays locked when the vault payment is pending", async () => {
  const { storage, provider, calls } = setup();
  let checks = 0;
  const note = await wallet.createAndPayStake({
    createInvoice: async () => ({ invoice, status: "created" }),
    checkPayment: async () => {
      checks += 1;
      return { status: checks === 1 ? "awaiting_payment" : "pending" };
    },
    storage,
    provider: {
      ...provider,
      sendAsset: async () => {
        calls.push("sendAsset");
        throw Error("Connection lost");
      },
    },
  });
  assert.match(note, /Waiting for payment confirmation/);
  assert.equal(storage.getItem(`goal-digger-stake-send:${invoice}`), "requested");
  await wallet.createAndPayStake({
    createInvoice: async () => ({ invoice, status: "created" }),
    checkPayment: async () => ({ status: "pending" }),
    storage,
    provider,
  });
  assert.equal(calls.filter((call) => call === "sendAsset").length, 1);
});

test("a saved awaiting invoice checks the vault before it opens the wallet", async () => {
  const { storage, provider, calls } = setup();
  await wallet.createAndPayStake({
    createInvoice: async () => {
      calls.push("create");
      return { invoice, status: "awaiting_payment" };
    },
    checkPayment: async () => {
      calls.push("check");
      return { status: "awaiting_payment" };
    },
    storage,
    provider,
  });
  assert.deepEqual(calls, ["create", "check", "enable", "sendAsset"]);
});

test("a new awaiting invoice opens the wallet without a status check", async () => {
  const { storage, provider, calls } = setup();
  const note = await wallet.createAndPayStake({
    createInvoice: async () => {
      calls.push("create");
      return { invoice, status: "awaiting_payment", fresh: true };
    },
    checkPayment: async () => {
      calls.push("check");
      return { status: "awaiting_payment" };
    },
    storage,
    provider,
  });
  assert.match(note, /confirmation/);
  assert.deepEqual(calls, ["create", "enable", "sendAsset"]);
});

test("an invoice that is already credited does not open the wallet", async () => {
  const { storage, provider, calls } = setup();
  const note = await wallet.createAndPayStake({
    createInvoice: async () => ({ invoice, status: "credited", fresh: true }),
    checkPayment: async () => {
      calls.push("check");
      return { status: "awaiting_payment" };
    },
    storage,
    provider,
  });
  assert.equal(note, "Payment confirmed.");
  assert.deepEqual(calls, []);
});

const witnessInvoice = "rgb:mutinynet?sbc:wvout:slot";

test("a witness invoice with the wrong asset never requests payment", async () => {
  const { storage, provider, calls } = setup();
  await assert.rejects(wallet.requestStakePayment(witnessInvoice, storage, {
    ...provider,
    decodeRgbInvoice: async () => ({
      assetId: "rgb:other", amount: 1, recipientId: "sbc:wvout:slot",
    }),
  }), /test USDT/);
  assert.equal(calls.includes("sendAsset"), false);
  assert.equal(storage.getItem(`goal-digger-stake-send:${witnessInvoice}`), null);
});

test("invoice remains available if approval is cancelled", async () => {
  const { storage, provider } = setup();
  let saved = "";
  await assert.rejects(wallet.createAndPayStake({
    createInvoice: async () => ({ invoice, status: "created" }),
    checkPayment: async () => ({ status: "awaiting_payment" }),
    onInvoice: (value: { invoice: string }) => { saved = value.invoice; },
    storage,
    provider: { ...provider, sendAsset: async () => { throw Object.assign(Error(), { code: "USER_REJECTED" }); } },
  }), /cancelled/);
  assert.equal(saved, invoice);
});

 test("a wallet cancellation preserves the provider error details", async () => {
  const { storage, provider } = setup();
  await assert.rejects(wallet.requestStakePayment(invoice, storage, {
    ...provider,
    sendAsset: async () => { throw { code: "USER_REJECTED", message: "Confirmation window closed" }; },
  }), /KaleidoSwap cancelled the approval: Confirmation window closed/);
  assert.equal(storage.getItem(`goal-digger-stake-send:${invoice}`), null);
});

test("a failed receipt check does not hide the wallet failure or unlock payment", async () => {
  const { storage, provider } = setup();
  let checks = 0;
  await assert.rejects(wallet.createAndPayStake({
    createInvoice: async () => ({ invoice, status: "created" }),
    checkPayment: async () => {
      if (++checks === 1) return { status: "awaiting_payment" };
      throw Error("Vault unavailable");
    },
    storage,
    provider: { ...provider, sendAsset: async () => { throw Error("Wallet transport failed"); } },
  }), /Wallet transport failed/);
  assert.equal(storage.getItem(`goal-digger-stake-send:${invoice}`), "requested");
});

test("explicit recovery requires wallet Activity and an unpaid deposit", async () => {
  for (const status of ["pending", "credited", "unknown", "review_required", "failed"]) {
    const { storage } = setup();
    storage.setItem(`goal-digger-stake-send:${invoice}`, "requested");
    await assert.rejects(wallet.clearUnconfirmedStakeRequest({
      invoice, storage, walletActivityChecked: true, checkPayment: async () => ({ status }),
    }));
    assert.equal(storage.getItem(`goal-digger-stake-send:${invoice}`), "requested");
  }
  const { storage } = setup();
  storage.setItem(`goal-digger-stake-send:${invoice}`, "requested");
  const options = { invoice, storage, walletActivityChecked: false, checkPayment: async () => ({ status: "awaiting_payment" }) };
  await assert.rejects(wallet.clearUnconfirmedStakeRequest(options), /Activity/);
  await wallet.clearUnconfirmedStakeRequest({ ...options, walletActivityChecked: true });
  assert.equal(storage.getItem(`goal-digger-stake-send:${invoice}`), null);
  storage.setItem(`goal-digger-stake-send:${invoice}`, "ab".repeat(32));
  await assert.rejects(wallet.clearUnconfirmedStakeRequest({ ...options, walletActivityChecked: true }), /unresolved/);
});
