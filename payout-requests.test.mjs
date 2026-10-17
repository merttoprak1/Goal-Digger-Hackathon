import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createVaultServer } from './vault.mjs';

const input = { payoutId: 'challenge-1-winner', challengeId: 'challenge-1', participantId: 'creator-1', amountAtomic: '1000000', invoice: 'rgb:recipient-1' };
function decoded(invoice) {
  return {
    network: 'SignetCustom', assetSchema: 'Nia',
    assetId: 'rgb:lX~ToKsO-Iup7dJ5-UM794sA-9WD21ge-VHYzBGb-E9PA_h0',
    recipientId: 'sbc:wvout:recipient-1', assignment: { Fungible: 1000000 },
    expirationTimestamp: Math.floor(Date.now() / 1000) + 3600,
    transportEndpoints: ['rpcs://proxy.iriswallet.com/0.2/json-rpc']
  };
}
async function open(databasePath, decodeInvoice = decoded) {
  const app = createVaultServer({ token: 'secret', databasePath, decodeInvoice,
    issueInvoice: async () => { throw Error('Must not call the wallet.'); },
    readDeposit: async () => { throw Error('Must not call the wallet.'); } });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${app.server.address().port}/vault/payouts`;
  return {
    post: (body, token = 'secret') => fetch(url, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    get: (id, token = 'secret') => fetch(`${url}/${id}`, { headers: { authorization: `Bearer ${token}` } }),
    stop: async () => { await new Promise(resolve => app.server.close(resolve)); app.close(); }
  };
}
function directory(t) {
  const dir = mkdtempSync(join(tmpdir(), 'payout-test-'));
  t.after(() => rmSync(dir, { recursive: true }));
  return join(dir, 'vault.sqlite');
}

test('payout requests are private, validate input, and reject invalid invoices', async t => {
  let calls = 0;
  let unavailable = false;
  const app = await open(directory(t), async () => { calls++; if (unavailable) throw Error('offline'); return null; });
  t.after(app.stop);
  assert.equal((await app.post(input, 'wrong')).status, 401);
  assert.equal((await app.get(input.payoutId, 'wrong')).status, 401);
  for (const change of [{ payoutId: '' }, { challengeId: '../x' }, { participantId: null }, { amountAtomic: 1000000 }, { amountAtomic: '0' }, { amountAtomic: '100000001' }, { invoice: 'bad' }, { invoice: 'rgb:' + 'x'.repeat(3000) }, { extra: true }]) {
    assert.equal((await app.post({ ...input, ...change })).status, 400);
  }
  assert.equal(calls, 0);
  assert.equal((await app.post(input)).status, 422);
  assert.equal((await app.get(input.payoutId)).status, 404);
  unavailable = true;
  assert.equal((await app.post(input)).status, 503);
  assert.equal((await app.get(input.payoutId)).status, 404);
});

test('concurrent payout retries save one immutable request without wallet operations', async t => {
  let calls = 0;
  const app = await open(directory(t), async invoice => { calls++; return decoded(invoice); });
  t.after(app.stop);
  const responses = await Promise.all([app.post(input), app.post(input)]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 201]);
  const results = await Promise.all(responses.map(r => r.json()));
  assert.deepEqual(results[0], results[1]);
  assert.equal(results[0].status, 'prepared');
  for (const key of Object.keys(input)) assert.equal(results[0][key], input[key]);
  assert.equal(results[0].recipientId, 'sbc:wvout:recipient-1');
  assert.equal(calls, 1);
  assert.deepEqual(await (await app.get(input.payoutId)).json(), results[0]);
  for (const change of [{ challengeId: 'challenge-2' }, { participantId: 'other' }, { amountAtomic: '2000000' }, { invoice: 'rgb:other' }]) {
    assert.equal((await app.post({ ...input, ...change })).status, 409);
  }
  assert.equal(calls, 1);
});

test('one RGB recipient cannot be attached to two payout IDs, including concurrent requests', async t => {
  const app = await open(directory(t));
  t.after(app.stop);
  const results = await Promise.all([app.post(input), app.post({ ...input, payoutId: 'other-payout', invoice: 'rgb:alternate-encoding' })]);
  assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
});

test('payout records survive restart and retries do not depend on decoder availability', async t => {
  const path = directory(t);
  const first = await open(path);
  let saved;
  try {
    const response = await first.post(input);
    assert.equal(response.status, 201);
    saved = await response.json();
  } finally { await first.stop(); }
  const second = await open(path, async () => { throw Error('Decoder must not run on a saved request.'); });
  t.after(second.stop);
  const response = await second.post(input);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), saved);
  assert.deepEqual(await (await second.get(input.payoutId)).json(), saved);
});
