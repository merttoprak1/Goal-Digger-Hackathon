import { test } from "node:test";
import assert from "node:assert/strict";
import { requestWitnessSend, type WitnessSend } from "../app/lib/kaleido-witness.ts";

const params: WitnessSend = {
  assetId: "rgb:test", amount: 5_000_000, recipientId: "sbc:wvout:recipient",
  transportEndpoints: ["rpcs://proxy.example/rpc"], feeRate: 1,
  witness_data: { amount_sat: 1000 },
};

function bridge() {
  const listeners = new Set<(event: MessageEvent) => void>();
  let request: { requestId: string };
  const page = {
    location: { origin: "https://demo.example" },
    addEventListener: (_: string, listener: (event: MessageEvent) => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: (event: MessageEvent) => void) => listeners.delete(listener),
    postMessage: (value: { requestId: string }) => { request = value; },
  };
  const emit = (data: Record<string, unknown>, event: Record<string, unknown> = {}) => {
    for (const listener of [...listeners]) listener({
      source: page, origin: page.location.origin,
      data: { application: "KaleidoSwap", type: "RGB_LIGHTNING_RESPONSE", requestId: request.requestId, ...data },
      ...event,
    } as unknown as MessageEvent);
  };
  return { page: page as unknown as Window, listeners, emit };
}

test("unrelated messages cannot complete a wallet payment", async () => {
  const { page, listeners, emit } = bridge();
  const result = requestWitnessSend(params, { page });
  const payload = { hash: "ab".repeat(32) };
  emit({ payload }, { source: {} });
  emit({ payload }, { origin: "https://untrusted.example" });
  emit({ payload, application: "Other wallet" });
  emit({ payload, type: "RGB_LIGHTNING_REQUEST" });
  emit({ payload, requestId: "old-request" });
  assert.equal(listeners.size, 1);
  emit({ payload });
  assert.deepEqual(await result, payload);
  assert.equal(listeners.size, 0);
});

test("wallet rejection preserves the exact error and removes its listener", async () => {
  const { page, listeners, emit } = bridge();
  const result = requestWitnessSend(params, { page });
  const rejected = assert.rejects(result, (error: unknown) => {
    assert.equal((error as Error).message, "missing witness data for a witness recipient");
    assert.equal((error as { code: string }).code, "INVALID_PARAMS");
    return true;
  });
  emit({ error: { code: "INVALID_PARAMS", message: "missing witness data for a witness recipient" } });
  await rejected;
  assert.equal(listeners.size, 0);
});

test("an approval with no response times out and ignores a late success", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { page, listeners, emit } = bridge();
  const result = requestWitnessSend(params, { page, timeoutMs: 100 });
  const rejected = assert.rejects(result, (error: unknown) => {
    assert.equal((error as { code: string }).code, "WALLET_TIMEOUT");
    assert.match((error as Error).message, /did not return a payment result/);
    return true;
  });
  t.mock.timers.tick(100);
  await rejected;
  assert.equal(listeners.size, 0);
  emit({ payload: { hash: "ab".repeat(32) } });
  await assert.rejects(result, /timeout/);
});

test("a failed browser message does not leave a listener or timer", async () => {
  const { page, listeners } = bridge();
  page.postMessage = () => { throw Error("Browser bridge disconnected"); };
  await assert.rejects(requestWitnessSend(params, { page }), /Browser bridge disconnected/);
  assert.equal(listeners.size, 0);
});
