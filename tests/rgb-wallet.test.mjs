import assert from "node:assert/strict";
import { test } from "node:test";
import { getRgbWallet, parseNodeJson } from "../qvac/rgb-wallet.mjs";

const zero = { settled: 0, future: 0, spendable: 0 };
const empty = { nia: [], uda: [], cfa: [], ifa: [] };
function nodeStub(assets = empty, bitcoin = { vanilla: zero, colored: zero }) {
  return async (url, options) => {
    if (url.endsWith("/btcbalance")) {
      assert.equal(options.method, "POST");
      assert.deepEqual(JSON.parse(options.body), { skip_sync: true });
      return Response.json(bitcoin);
    }
    if (url.endsWith("/listassets")) return Response.json(assets);
    return Response.json({ network: "SignetCustom", wallet_secret: "must-not-leak" });
  };
}

test("preserves exact integer amounts beyond the JavaScript safe range", () => {
  const value = parseNodeJson('{"amount":18446744073709551615}');
  assert.equal(value.amount, "18446744073709551615");
});

test("returns an empty asset list without creating a USDT balance", async () => {
  const wallet = await getRgbWallet(nodeStub());
  assert.deepEqual(wallet.assets, []);
  assert.equal(wallet.bitcoin.vanilla.spendable, "0");
  assert.equal(wallet.balanceSource, "cached");
  assert.equal(JSON.stringify(wallet).includes("must-not-leak"), false);
});

test("keeps asset identifiers, precision, balances, and bitcoin units distinct", async () => {
  const asset = {
    asset_id: "rgb:test-asset",
    name: "Test token",
    ticker: "TEST",
    precision: 6,
    balance: {
      settled: "18446744073709551615",
      future: 100,
      spendable: 90,
      offchain_outbound: 10,
      offchain_inbound: 5,
    },
    details: "must-not-leak",
  };
  const wallet = await getRgbWallet(nodeStub({ ...empty, nia: [asset] }));
  assert.equal(wallet.assets[0].assetId, "rgb:test-asset");
  assert.equal(wallet.assets[0].precision, 6);
  assert.equal(wallet.assets[0].balance.settled, "18446744073709551615");
  assert.equal(wallet.assets[0].balance.offchainOutbound, "10");
  assert.equal(wallet.bitcoin.unit, "sat");
  assert.equal(wallet.assets[0].unit, "atomic");
  assert.equal(JSON.stringify(wallet).includes("must-not-leak"), false);
});

test("does not turn missing data or node failures into zero balances", async () => {
  for (const assets of [
    {},
    { ...empty, nia: null },
    { ...empty, nia: [{ asset_id: "rgb:bad" }] },
  ]) {
    await assert.rejects(getRgbWallet(nodeStub(assets)), { status: 502 });
  }
  await assert.rejects(getRgbWallet(nodeStub(empty, { vanilla: {}, colored: zero })), {
    status: 502,
  });
  await assert.rejects(
    getRgbWallet(async () => new Response(null, { status: 403 })),
    { status: 503 },
  );
  await assert.rejects(
    getRgbWallet(async () => {
      throw new TypeError("fetch failed");
    }),
    { status: 503 },
  );
});
