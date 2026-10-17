import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createVaultServer, assessDeposit } from "./vault.mjs";

async function fixture(t, issueInvoice, readDeposit, decodeInvoice) {
  const dir = mkdtempSync(join(tmpdir(), "vault-test-"));
  const app = createVaultServer({
    token: "test-secret",
    databasePath: join(dir, "vault.sqlite"),
    issueInvoice,
    readDeposit,
    decodeInvoice,
  });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise((resolve) => app.server.close(resolve));
    app.close();
    rmSync(dir, { recursive: true });
  });
  const url = `http://127.0.0.1:${app.server.address().port}/vault/deposits`;
  return {
    app,
    validate: (body, token = "test-secret") =>
      fetch(url.replace("/deposits", "/payouts/validate"), {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    status: (id = "stake-1", token = "test-secret") =>
      fetch(`${url}/${id}`, { headers: { authorization: `Bearer ${token}` } }),
    request: (body, token = "test-secret") =>
      fetch(url, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
  };
}
const input = { paymentId: "stake-1", amountAtomic: "1000000" };
const invoice = {
  invoice: "rgb:test",
  recipientId: "sbc:wvout:test",
  expirationTimestamp: 1900000000,
};

test("payout validation is private and distinguishes invalid invoices from decoder outages", async (t) => {
  let offline = false;
  let calls = 0;
  const { validate } = await fixture(
    t,
    async () => {
      throw new Error("Must not create an invoice.");
    },
    undefined,
    async () => {
      calls++;
      if (offline) throw new Error("unavailable");
      return null;
    },
  );
  const body = { invoice: "rgb:invalid", amountAtomic: "1000000" };
  assert.equal((await validate(body, "wrong")).status, 401);
  assert.equal((await validate({ ...body, amountAtomic: 1000000 })).status, 400);
  assert.equal(calls, 0);
  const invalid = await validate(body);
  assert.equal(invalid.status, 422);
  assert.equal((await invalid.json()).valid, false);
  offline = true;
  assert.equal((await validate(body)).status, 503);
});

test("private deposits persist one invoice across concurrent retries and reject changed amounts", async (t) => {
  let calls = 0;
  const { request } = await fixture(t, async () => {
    calls++;
    return invoice;
  });
  assert.equal((await request(input, "wrong")).status, 401);
  const responses = await Promise.all([request(input), request(input)]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 201]);
  const bodies = await Promise.all(responses.map((r) => r.json()));
  assert.deepEqual(bodies[0], bodies[1]);
  assert.equal(bodies[0].status, "awaiting_payment");
  assert.equal(calls, 1);
  assert.equal((await request({ ...input, amountAtomic: "2000000" })).status, 409);
  assert.equal((await request({ ...input, amountAtomic: 1000000 })).status, 400);
});

const deposit = {
  assetId: "rgb:expected",
  recipientId: invoice.recipientId,
  amountAtomic: "1000000",
};
const matching = {
  recipientId: invoice.recipientId,
  kind: "ReceiveWitness",
  status: "Settled",
  txid: "a".repeat(64),
  assignments: [{ Fungible: 1000000 }],
};
const snapshot = (transfers) => ({ assetId: deposit.assetId, transfers });

test("only an exact settled incoming transfer confirms a deposit", () => {
  assert.equal(assessDeposit(deposit, snapshot([matching])).status, "settled");
  for (const changed of [{ kind: "Send" }, { recipientId: "other" }]) {
    assert.equal(
      assessDeposit(deposit, snapshot([{ ...matching, ...changed }])).status,
      "unknown",
    );
  }
  for (const changed of [
    { assignments: [{ Fungible: 999999 }] },
    { assignments: [] },
    { txid: null },
  ]) {
    assert.equal(
      assessDeposit(deposit, snapshot([{ ...matching, ...changed }])).status,
      "review_required",
    );
  }
  assert.equal(
    assessDeposit(deposit, snapshot([{ ...matching, status: "WaitingConfirmations" }]))
      .status,
    "pending",
  );
  assert.equal(
    assessDeposit(
      deposit,
      snapshot([
        { ...matching, status: "WaitingCounterparty", txid: null, assignments: [] },
      ]),
    ).status,
    "awaiting_payment",
  );
  assert.equal(
    assessDeposit(deposit, snapshot([{ ...matching, status: "Failed" }])).status,
    "failed",
  );
  assert.equal(
    assessDeposit(deposit, { assetId: "rgb:other", transfers: [matching] }).status,
    "unknown",
  );
  assert.equal(
    assessDeposit(deposit, snapshot([matching, matching])).status,
    "review_required",
  );
});

test("status requires authentication and wallet errors do not become lost deposits", async (t) => {
  let fail = false;
  const { request, status } = await fixture(
    t,
    async () => invoice,
    async (saved) => {
      if (fail) throw new Error("offline");
      return { assetId: saved.assetId, transfers: [matching] };
    },
  );
  assert.equal((await status("stake-1", "wrong")).status, 401);
  assert.equal((await status("missing")).status, 404);
  await request(input);
  const first = await status();
  assert.equal(first.status, 200);
  assert.equal((await first.json()).status, "settled");
  const invoiceRetry = await request(input);
  assert.equal(invoiceRetry.status, 200);
  assert.equal((await invoiceRetry.json()).status, "awaiting_payment");
  fail = true;
  assert.equal((await status()).status, 503);
  fail = false;
  assert.equal((await (await status()).json()).status, "settled");
});

test("uncertain invoice creation stays unknown and never repeats the wallet call", async (t) => {
  let calls = 0;
  const { request } = await fixture(t, async () => {
    calls++;
    throw new Error("timeout");
  });
  assert.equal((await request(input)).status, 503);
  const retry = await request(input);
  assert.equal(retry.status, 409);
  assert.equal((await retry.json()).status, "unknown");
  assert.equal(calls, 1);
});

test("completed and uncertain records survive server restart", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "vault-restart-"));
  t.after(() => rmSync(dir, { recursive: true }));
  const databasePath = join(dir, "vault.sqlite");
  let calls = 0;
  for (let pass = 0; pass < 2; pass++) {
    const app = createVaultServer({
      token: "secret",
      databasePath,
      issueInvoice: async (amount) => {
        calls++;
        if (amount === "2000000") throw new Error("timeout");
        return invoice;
      },
    });
    await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
    try {
      const request = (body) =>
        fetch(`http://127.0.0.1:${app.server.address().port}/vault/deposits`, {
          method: "POST",
          headers: { authorization: "Bearer secret", "content-type": "application/json" },
          body: JSON.stringify(body),
        });
      const good = await request(input);
      assert.equal(good.status, pass === 0 ? 201 : 200);
      assert.equal((await good.json()).invoice, invoice.invoice);
      const uncertain = await request({ paymentId: "stake-2", amountAtomic: "2000000" });
      assert.equal(uncertain.status, pass === 0 ? 503 : 409);
    } finally {
      await new Promise((resolve) => app.server.close(resolve));
      app.close();
    }
  }
  assert.equal(calls, 2);
});
