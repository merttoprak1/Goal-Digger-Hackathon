import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openStakeDeposits } from './stake-deposits.mjs';

const binding = { paymentId: 'stake-1', challengeId: 'challenge-1', participantId: 'creator-1', amountAtomic: '1000000' };
const assetId = 'rgb:lX~ToKsO-Iup7dJ5-UM794sA-9WD21ge-VHYzBGb-E9PA_h0';
const invoice = { paymentId: 'stake-1', assetId, amountAtomic: '1000000', invoice: 'rgb:invoice', recipientId: 'sbc:wvout:recipient', status: 'awaiting_payment' };
const settled = { ...invoice, status: 'settled', txid: 'a'.repeat(64) };
function setup(t) {
  const dir = mkdtempSync(join(tmpdir(), 'stake-deposits-'));
  t.after(() => rmSync(dir, { recursive: true }));
  return join(dir, 'stakes.sqlite');
}
function vault(reply = () => settled) {
  return async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer private-token');
    return new Response(JSON.stringify(options.method === 'POST' ? invoice : reply()), { status: options.method === 'POST' ? 201 : 200 });
  };
}

test('a settled deposit credits one bound stake across concurrent retries and restart', async t => {
  const databasePath = setup(t);
  for (let pass = 0; pass < 2; pass++) {
    const store = openStakeDeposits({ databasePath, token: 'private-token', fetchService: vault() });
    try {
      await store.bind(binding);
      const results = await Promise.all([store.confirm('stake-1'), store.confirm('stake-1')]);
      assert.equal(results.filter(r => r.newlyCredited).length, pass === 0 ? 1 : 0);
      assert.equal(store.listCredits('challenge-1').length, 1);
      assert.equal(store.listCredits('challenge-1')[0].participantId, 'creator-1');
      await assert.rejects(store.bind({ ...binding, participantId: 'other' }), /different stake/);
    } finally { store.close(); }
  }
});

test('pending, incorrect, and unavailable vault results never credit a stake', async t => {
  let reply = { ...settled, status: 'pending' };
  let offline = false;
  const fetchService = async (...args) => { if (offline) throw new Error('offline'); return vault(() => reply)(...args); };
  const store = openStakeDeposits({ databasePath: setup(t), token: 'private-token', fetchService });
  t.after(() => store.close());
  await store.bind(binding);
  assert.equal((await store.confirm('stake-1')).status, 'pending');
  for (const change of [{ amountAtomic: '999999' }, { assetId: 'wrong' }, { recipientId: 'other' }, { paymentId: 'other' }, { txid: null }]) {
    reply = { ...settled, ...change };
    await assert.rejects(store.confirm('stake-1'));
    assert.equal(store.listCredits('challenge-1').length, 0);
  }
  offline = true;
  await assert.rejects(store.confirm('stake-1'));
  assert.equal(store.listCredits('challenge-1').length, 0);
});

test('the same transfer receipt cannot credit a second payment ID', async t => {
  let id = 'stake-1';
  const fetchService = async (url, options) => new Response(JSON.stringify({
    ...(options.method === 'POST' ? invoice : settled), paymentId: id
  }), { status: 200 });
  const store = openStakeDeposits({ databasePath: setup(t), token: 'private-token', fetchService });
  t.after(() => store.close());
  await store.bind(binding);
  await store.confirm(id);
  id = 'stake-2';
  await store.bind({ ...binding, paymentId: id, participantId: 'other' });
  await assert.rejects(store.confirm(id), /already credited/);
  assert.equal(store.listCredits('challenge-1').length, 1);
});
