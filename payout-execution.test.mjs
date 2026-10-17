import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createVaultServer } from "./vault.mjs";
const input = {
  payoutId: "award-1",
  challengeId: "challenge-1",
  participantId: "winner-1",
  amountAtomic: "1000000",
  invoice: "rgb:recipient-1",
};
const txid = "b".repeat(64);
const decoded = () => ({
  network: "SignetCustom",
  assetSchema: "Nia",
  assetId: "rgb:lX~ToKsO-Iup7dJ5-UM794sA-9WD21ge-VHYzBGb-E9PA_h0",
  recipientId: "sbc:wvout:recipient-1",
  assignment: { Fungible: 1000000 },
  expirationTimestamp: Math.floor(Date.now() / 1000) + 3600,
  transportEndpoints: ["rpcs://proxy.iriswallet.com/0.2/json-rpc"],
});
async function open(path, executePayout, decodeInvoice = decoded) {
  const app = createVaultServer({
    token: "secret",
    databasePath: path,
    executePayout,
    decodeInvoice,
  });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${app.server.address().port}/vault/payouts`;
  const post = (suffix, body, token = "secret") =>
    fetch(url + suffix, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  return {
    save: () => post("", input),
    execute: (body = {}, token = "secret", id = input.payoutId) =>
      post(`/${id}/execute`, body, token),
    get: () =>
      fetch(`${url}/${input.payoutId}`, { headers: { authorization: "Bearer secret" } }),
    stop: async () => {
      await new Promise((resolve) => app.server.close(resolve));
      app.close();
    },
  };
}
function database(t) {
  const dir = mkdtempSync(join(tmpdir(), "execute-payout-"));
  t.after(() => rmSync(dir, { recursive: true }));
  return join(dir, "vault.sqlite");
}

test("execution authenticates, accepts only an empty body, and requires a saved payout", async (t) => {
  let calls = 0;
  const app = await open(database(t), async () => {
    calls++;
    return { txid };
  });
  t.after(app.stop);
  assert.equal((await app.execute({}, "wrong")).status, 401);
  for (const body of [null, [], { invoice: "rgb:other" }, { amountAtomic: "2" }])
    assert.equal((await app.execute(body)).status, 400);
  assert.equal((await app.execute()).status, 404);
  assert.equal(calls, 0);
});

test("execution journals unknown before WDK and concurrent retries return one accepted transaction", async (t) => {
  let calls = 0;
  const app = await open(database(t), async (saved) => {
    calls++;
    assert.equal(saved.invoice, input.invoice);
    assert.equal(saved.amountAtomic, input.amountAtomic);
    assert.equal((await (await app.get()).json()).status, "unknown");
    return { txid };
  });
  t.after(app.stop);
  await app.save();
  const responses = await Promise.all([app.execute(), app.execute()]);
  assert.deepEqual(
    responses.map((r) => r.status),
    [200, 200],
  );
  const bodies = await Promise.all(responses.map((r) => r.json()));
  assert.deepEqual(bodies[0], bodies[1]);
  assert.equal(bodies[0].status, "accepted");
  assert.equal(bodies[0].txid, txid);
  assert.equal(calls, 1);
});

test("accepted and uncertain attempts survive restarts without another send", async (t) => {
  for (const uncertain of [false, true]) {
    const path = database(t);
    let calls = 0;
    const app = await open(path, async () => {
      calls++;
      if (uncertain) throw Error("timeout after possible send");
      return { txid };
    });
    try {
      await app.save();
      assert.equal((await app.execute()).status, uncertain ? 503 : 200);
    } finally {
      await app.stop();
    }
    const restarted = await open(
      path,
      async () => {
        calls++;
        throw Error("Must not send twice");
      },
      async () => {
        throw Error("Must not decode an existing attempt");
      },
    );
    try {
      const response = await restarted.execute();
      assert.equal(response.status, uncertain ? 409 : 200);
      assert.equal((await response.json()).status, uncertain ? "unknown" : "accepted");
      assert.equal(
        (await (await restarted.get()).json()).status,
        uncertain ? "unknown" : "accepted",
      );
      assert.equal(calls, 1);
    } finally {
      await restarted.stop();
    }
  }
});

test("expired or changed invoices stop before the send attempt, decoder outages remain retryable", async (t) => {
  let current = decoded();
  let offline = false;
  let calls = 0;
  const app = await open(
    database(t),
    async () => {
      calls++;
      return { txid };
    },
    async () => {
      if (offline) throw Error("offline");
      return current;
    },
  );
  t.after(app.stop);
  await app.save();
  for (const change of [
    { expirationTimestamp: 1 },
    { recipientId: "sbc:wvout:other" },
    { assignment: { Fungible: 2 } },
  ]) {
    current = { ...decoded(), ...change };
    assert.equal((await app.execute()).status, 422);
    assert.equal((await (await app.get()).json()).status, "prepared");
  }
  current = decoded();
  offline = true;
  assert.equal((await app.execute()).status, 503);
  assert.equal((await (await app.get()).json()).status, "prepared");
  offline = false;
  assert.equal((await app.execute()).status, 200);
  assert.equal(calls, 1);
});

test("a malformed sender result stays unknown and never triggers a second call", async (t) => {
  let calls = 0;
  const app = await open(database(t), async () => {
    calls++;
    return { txid: "invalid" };
  });
  t.after(app.stop);
  await app.save();
  assert.equal((await app.execute()).status, 503);
  assert.equal((await app.execute()).status, 409);
  assert.equal(calls, 1);
});

test("database claim prevents two server instances from executing the same payout", async (t) => {
  const path = database(t);
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  let started;
  const entered = new Promise((resolve) => {
    started = resolve;
  });
  const first = await open(path, async () => {
    calls++;
    started();
    await gate;
    return { txid };
  });
  const second = await open(path, async () => {
    calls++;
    return { txid };
  });
  t.after(first.stop);
  t.after(second.stop);
  await first.save();
  const sending = first.execute();
  const earlyResponse = await Promise.race([entered.then(() => null), sending]);
  if (earlyResponse) assert.equal(earlyResponse.status, 200);
  try {
    assert.equal((await second.execute()).status, 409);
  } finally {
    release();
  }
  assert.equal((await sending).status, 200);
  assert.equal(calls, 1);
});
