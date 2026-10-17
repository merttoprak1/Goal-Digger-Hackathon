import { test } from "node:test";
import assert from "node:assert/strict";
import { requestStakePayment, TEST_USDT_ASSET } from "../app/lib/wallet.ts";

const invoice = "rgb:test/sbc:wvout:recipient";
const missingWitness = "The provided recipient data is invalid: missing witness data for a witness recipient";

test("a witness stake includes the Bitcoin output data required by the wallet", async () => {
  const previous = globalThis.window;
  const listeners = new Set<(event: MessageEvent) => void>();
  const requests: Record<string, unknown>[] = [];
  const page = {
    location: { origin: "https://demo.example" },
    addEventListener: (_: string, listener: (event: MessageEvent) => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: (event: MessageEvent) => void) => listeners.delete(listener),
    postMessage(request: { requestId: string; payload: { type: string; params: Record<string, unknown> } }, origin: string) {
      assert.equal(origin, page.location.origin);
      requests.push(request.payload.params);
      const witness = request.payload.params.witness_data as { amount_sat?: number } | undefined;
      const error = witness?.amount_sat === 1000 ? undefined : { code: "INVALID_PARAMS", message: missingWitness };
      queueMicrotask(() => {
        for (const listener of listeners) listener({
          source: page, origin,
          data: { type: "RGB_LIGHTNING_RESPONSE", application: "KaleidoSwap", requestId: request.requestId,
            ...(error ? { error } : { payload: { hash: "ab".repeat(32) } }) },
        } as unknown as MessageEvent);
      });
    },
  };
  globalThis.window = page as unknown as Window & typeof globalThis;
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  let shortcutCalls = 0;
  try {
    await requestStakePayment(invoice, storage, {
      enable: async () => {},
      getInfo: async () => ({ ready: true, network: "signet", protocol: "RGB_L1", methods: ["sendAsset", "decodeRgbInvoice"] }),
      listAssets: async () => [],
      decodeRgbInvoice: async () => ({ assetId: TEST_USDT_ASSET, amount: 5_000_000, recipientId: "sbc:wvout:recipient", transportEndpoints: ["rpcs://proxy.example/rpc"] }),
      sendAsset: async () => { shortcutCalls += 1; throw Error(missingWitness); },
    });
    assert.equal(shortcutCalls, 0);
    assert.deepEqual(requests, [{
      assetId: TEST_USDT_ASSET, amount: 5_000_000, recipientId: "sbc:wvout:recipient",
      transportEndpoints: ["rpcs://proxy.example/rpc"], feeRate: 1,
      witness_data: { amount_sat: 1000 },
    }]);
    assert.equal(storage.getItem(`goal-digger-stake-send:${invoice}`), "ab".repeat(32));
    assert.equal(listeners.size, 0);
  } finally {
    globalThis.window = previous;
  }
});

test("a silent witness approval keeps the invoice locked after timeout", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const previous = globalThis.window;
  const listeners = new Set<(event: MessageEvent) => void>();
  let posted!: () => void;
  const started = new Promise<void>(resolve => { posted = resolve; });
  let sends = 0;
  const page = {
    location: { origin: "https://demo.example" },
    addEventListener: (_: string, listener: (event: MessageEvent) => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: (event: MessageEvent) => void) => listeners.delete(listener),
    postMessage: () => { sends += 1; posted(); },
  };
  globalThis.window = page as unknown as Window & typeof globalThis;
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  const provider = {
    enable: async () => {},
    getInfo: async () => ({ ready: true, network: "signet", protocol: "RGB_L1", methods: ["sendAsset"] }),
    listAssets: async () => [],
    decodeRgbInvoice: async () => ({ assetId: TEST_USDT_ASSET, amount: 5_000_000, recipientId: "sbc:wvout:recipient", transportEndpoints: ["rpcs://proxy.example/rpc"] }),
    sendAsset: async () => { throw Error("The invoice shortcut must not be used"); },
  };
  try {
    const request = requestStakePayment(invoice, storage, provider);
    const rejected = assert.rejects(request, /did not return a payment result/);
    await started;
    t.mock.timers.tick(135_000);
    await rejected;
    assert.equal(storage.getItem(`goal-digger-stake-send:${invoice}`), "requested");
    await assert.rejects(requestStakePayment(invoice, storage, provider), /Check payment/);
    assert.equal(sends, 1);
    assert.equal(listeners.size, 0);
  } finally {
    globalThis.window = previous;
  }
});
