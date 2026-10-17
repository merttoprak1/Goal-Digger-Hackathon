import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import type { ChallengeResponse } from '../shared/contracts.ts';
import { createApp } from './app.ts';
import { createStore } from './store.ts';

const directory = mkdtempSync(join(tmpdir(), 'goal-digger-test-'));
const path = join(directory, 'challenges.sqlite');
const store = createStore(path);
const app = createApp(store, () => new Date('2030-01-01T00:00:00Z'));
const server = app.listen(0, '127.0.0.1');
let base: string;

before(async () => {
  await once(server, 'listening');
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  store.close();
  rmSync(directory, { recursive: true, force: true });
});

const input = {
  template: 'wake_up', creatorName: 'Mert', title: 'Wake up at 07:00', requestedStakeUsdt: '5',
  timezone: 'Europe/Rome', bettingClosesAt: '2030-01-02T06:00:00+01:00',
  startsAt: '2030-01-02T07:00:00+01:00', proofDeadline: '2030-01-02T07:05:00+01:00',
};
function post(body: unknown) {
  return fetch(`${base}/api/challenges`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

test('creates a draft with fixed server-owned proof terms and persists it in SQLite', async () => {
  const response = await post(input);
  assert.equal(response.status, 201);
  const { challenge } = await response.json() as ChallengeResponse;
  assert.equal(challenge.status, 'draft');
  assert.equal(challenge.termsEditable, false);
  assert.equal(challenge.funding.confirmedPoolUsdt, null);
  assert.equal(challenge.proof.method, 'timed_math');
  assert.equal(response.headers.get('location'), `/api/challenges/${challenge.id}`);
  const retrieved = await fetch(`${base}/api/challenges/${challenge.id}`);
  assert.deepEqual((await retrieved.json()).challenge, challenge);
  const reopened = createStore(path);
  try { assert.deepEqual(reopened.get(challenge.id), challenge); }
  finally { reopened.close(); }
  const list = await fetch(`${base}/api/challenges`);
  assert.ok((await list.json()).challenges.some((item: { id: string }) => item.id === challenge.id));
  const edit = await fetch(`${base}/api/challenges/${challenge.id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ proof: { successRule: 'Changed' } }),
  });
  assert.equal(edit.status, 404);
  assert.deepEqual(store.get(challenge.id), challenge);
});

test('rejects invalid terms and client attempts to forge verdicts or funding', async () => {
  const invalid = [
    { requestedStakeUsdt: '0' }, { requestedStakeUsdt: '-5' }, { requestedStakeUsdt: '1e3' },
    { requestedStakeUsdt: '0.0000001' }, { creatorName: '   ' }, { timezone: 'Invalid/Timezone' },
    { bettingClosesAt: '2030-01-02T07:01:00+01:00' }, { bettingClosesAt: '2029-01-01T00:00:00Z' },
    { proofDeadline: input.startsAt }, { startsAt: '2030-01-02T07:00:00' },
    { proof: { method: 'trust_me' } }, { status: 'won' }, { funding: { status: 'confirmed' } },
    { template: 'custom' },
  ];
  const count = store.list().length;
  for (const override of invalid) {
    const response = await post({ ...input, ...override });
    assert.equal(response.status, 400, JSON.stringify(override));
    assert.equal((await response.json()).error.code, 'INVALID_CHALLENGE');
  }
  assert.equal(store.list().length, count);
});

test('returns JSON errors for malformed bodies, missing challenges, and unsupported actions', async () => {
  const malformed = await fetch(`${base}/api/challenges`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
  });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).error.code, 'INVALID_BODY');
  const missing = await fetch(`${base}/api/challenges/missing`);
  assert.equal(missing.status, 404);
  const bet = await fetch(`${base}/api/challenges/missing/bets`, { method: 'POST' });
  assert.equal(bet.status, 404);
  const health = await fetch(`${base}/api/health`);
  assert.deepEqual(await health.json(), {
    status: 'ok', integrations: { rgb: 'not_connected', qvac: 'not_connected' },
  });
});
