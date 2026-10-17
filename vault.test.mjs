import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createVaultServer } from './vault.mjs';

async function fixture(t, issueInvoice) {
  const dir = mkdtempSync(join(tmpdir(), 'vault-test-'));
  const app = createVaultServer({ token: 'test-secret', databasePath: join(dir, 'vault.sqlite'), issueInvoice });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => app.server.close(resolve)); app.close(); rmSync(dir, { recursive: true }); });
  const url = `http://127.0.0.1:${app.server.address().port}/vault/deposits`;
  return { app, request: (body, token = 'test-secret') => fetch(url, {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body)
  }) };
}
const input = { paymentId: 'stake-1', amountAtomic: '1000000' };
const invoice = { invoice: 'rgb:test', recipientId: 'sbc:wvout:test', expirationTimestamp: 1900000000 };

test('private deposits persist one invoice across concurrent retries and reject changed amounts', async t => {
  let calls = 0;
  const { request } = await fixture(t, async () => { calls++; return invoice; });
  assert.equal((await request(input, 'wrong')).status, 401);
  const responses = await Promise.all([request(input), request(input)]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 201]);
  const bodies = await Promise.all(responses.map(r => r.json()));
  assert.deepEqual(bodies[0], bodies[1]);
  assert.equal(bodies[0].status, 'awaiting_payment');
  assert.equal(calls, 1);
  assert.equal((await request({ ...input, amountAtomic: '2000000' })).status, 409);
  assert.equal((await request({ ...input, amountAtomic: 1000000 })).status, 400);
});

test('uncertain invoice creation stays unknown and never repeats the wallet call', async t => {
  let calls = 0;
  const { request } = await fixture(t, async () => { calls++; throw new Error('timeout'); });
  assert.equal((await request(input)).status, 503);
  const retry = await request(input);
  assert.equal(retry.status, 409);
  assert.equal((await retry.json()).status, 'unknown');
  assert.equal(calls, 1);
});

test('completed and uncertain records survive server restart', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'vault-restart-'));
  t.after(() => rmSync(dir, { recursive: true }));
  const databasePath = join(dir, 'vault.sqlite');
  let calls = 0;
  for (let pass = 0; pass < 2; pass++) {
    const app = createVaultServer({ token: 'secret', databasePath, issueInvoice: async amount => {
      calls++;
      if (amount === '2000000') throw new Error('timeout');
      return invoice;
    } });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    try {
      const request = body => fetch(`http://127.0.0.1:${app.server.address().port}/vault/deposits`, {
        method: 'POST', headers: { authorization: 'Bearer secret', 'content-type': 'application/json' }, body: JSON.stringify(body)
      });
      const good = await request(input);
      assert.equal(good.status, pass === 0 ? 201 : 200);
      assert.equal((await good.json()).invoice, invoice.invoice);
      const uncertain = await request({ paymentId: 'stake-2', amountAtomic: '2000000' });
      assert.equal(uncertain.status, pass === 0 ? 503 : 409);
    } finally {
      await new Promise(resolve => app.server.close(resolve));
      app.close();
    }
  }
  assert.equal(calls, 2);
});
