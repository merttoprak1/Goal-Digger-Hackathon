import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { timingSafeEqual } from 'node:crypto';

const assetId = 'rgb:lX~ToKsO-Iup7dJ5-UM794sA-9WD21ge-VHYzBGb-E9PA_h0';
const error = (status, message) => Object.assign(new Error(message), { status });
function issueInvoice(amountAtomic) {
  const cwd = fileURLToPath(new URL('./wdk/', import.meta.url));
  return new Promise((resolve, reject) => execFile(`${cwd}/node_modules/.bin/bare`, ['check.mjs', 'deposit', amountAtomic],
    { cwd, timeout: 60_000, maxBuffer: 65536 }, (err, stdout) => {
      if (err) return reject(new Error('The WDK invoice request failed.'));
      try {
        const body = JSON.parse(stdout);
        const receive = body.rgb?.receive;
        if (body.nativeNetwork !== 'SignetCustom' || body.rgb?.assetId !== assetId || body.rgb?.amountAtomic !== amountAtomic ||
            typeof receive?.invoice !== 'string' || !receive.recipientId?.startsWith('sbc:wvout:') ||
            !Number.isInteger(receive.expirationTimestamp) || receive.expirationTimestamp <= Date.now() / 1000) throw new Error();
        resolve({ invoice: receive.invoice, recipientId: receive.recipientId, expirationTimestamp: receive.expirationTimestamp });
      } catch { reject(new Error('WDK returned an invalid invoice.')); }
    }));
}

function readDeposit(saved) {
  const cwd = fileURLToPath(new URL('./wdk/', import.meta.url));
  return new Promise((resolve, reject) => execFile(`${cwd}/node_modules/.bin/bare`, ['check.mjs', 'deposit-status', saved.recipientId],
    { cwd, timeout: 60_000, maxBuffer: 65536 }, (err, stdout) => {
      if (err) return reject(new Error('The WDK status request failed.'));
      try {
        const body = JSON.parse(stdout);
        if (body.nativeNetwork !== 'SignetCustom' || !Array.isArray(body.rgb?.transfers)) throw new Error();
        resolve(body.rgb);
      } catch { reject(new Error('WDK returned invalid transfer data.')); }
    }));
}

export function assessDeposit(saved, snapshot) {
  if (snapshot?.assetId !== saved.assetId || !Array.isArray(snapshot.transfers)) return { status: 'unknown', txid: null };
  const matches = snapshot.transfers.filter(t => t.recipientId === saved.recipientId && t.kind === 'ReceiveWitness');
  if (!matches.length) return { status: 'unknown', txid: null };
  if (matches.length !== 1) return { status: 'review_required', txid: null };
  const transfer = matches[0];
  const txid = typeof transfer.txid === 'string' && /^[a-f0-9]{64}$/.test(transfer.txid) ? transfer.txid : null;
  if (transfer.status === 'Failed') return { status: 'failed', txid };
  if (transfer.status === 'WaitingCounterparty' && !txid && !transfer.assignments?.length) return { status: 'awaiting_payment', txid: null };
  const assignments = transfer.assignments;
  if (!txid || !Array.isArray(assignments) || !assignments.length || assignments.some(a =>
    !a || Object.keys(a).join(',') !== 'Fungible' || !Number.isSafeInteger(a.Fungible) || a.Fungible < 0) ||
    assignments.reduce((sum, a) => sum + BigInt(a.Fungible), 0n) !== BigInt(saved.amountAtomic)) {
    return { status: 'review_required', txid };
  }
  if (transfer.status === 'Settled') return { status: 'settled', txid };
  if (['WaitingBroadcast', 'WaitingConfirmations'].includes(transfer.status)) return { status: 'pending', txid };
  return { status: 'unknown', txid };
}

export function createVaultServer({ token, databasePath, issueInvoice: issue = issueInvoice, readDeposit: inspect = readDeposit }) {
  if (typeof token !== 'string' || !token) throw new Error('Set VAULT_API_TOKEN before starting the vault.');
  mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(databasePath);
  chmodSync(databasePath, 0o600);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS deposits (id TEXT PRIMARY KEY, amount TEXT NOT NULL, result TEXT NOT NULL)');
  const read = db.prepare('SELECT amount, result FROM deposits WHERE id = ?');
  const insert = db.prepare('INSERT INTO deposits VALUES (?, ?, ?)');
  const update = db.prepare('UPDATE deposits SET result = ? WHERE id = ?');
  db.exec('CREATE TABLE IF NOT EXISTS deposit_status (id TEXT PRIMARY KEY, result TEXT NOT NULL)');
  const updateStatus = db.prepare('INSERT INTO deposit_status (result, id) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET result = excluded.result');
  let queue = Promise.resolve();
  const server = createServer({ requestTimeout: 10_000 }, async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    const reply = (status, body) => res.writeHead(status).end(JSON.stringify(body));
    try {
      const supplied = Buffer.from(req.headers.authorization || '');
      const expected = Buffer.from(`Bearer ${token}`);
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw error(401, 'A valid vault token is required.');
      const statusMatch = /^\/vault\/deposits\/([a-zA-Z0-9_-]{1,80})$/.exec(req.url || '');
      if (statusMatch) {
        if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); throw error(405, 'Use GET for this endpoint.'); }
        const operation = queue.then(async () => {
          const old = read.get(statusMatch[1]);
          if (!old) throw error(404, 'Payment ID not found.');
          const saved = JSON.parse(old.result);
          if (!saved.recipientId || !saved.invoice) return { ...saved, status: 'unknown', txid: null };
          const checked = assessDeposit(saved, await inspect(saved));
          // Keep invoice creation state separate so POST retries still return the original invoice.
          const result = { ...saved, ...checked, checkedAt: new Date().toISOString() };
          updateStatus.run(JSON.stringify(result), statusMatch[1]);
          return result;
        });
        queue = operation.catch(() => {});
        reply(200, await operation);
        return;
      }
      if (req.url !== '/vault/deposits') throw error(404, 'Endpoint not found.');
      if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); throw error(405, 'Use POST for this endpoint.'); }
      if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') throw error(415, 'Send Content-Type: application/json.');
      let raw = '';
      for await (const chunk of req.iterator({ destroyOnReturn: false })) {
        raw += chunk;
        if (Buffer.byteLength(raw) > 4096) { req.resume(); throw error(413, 'The request body must not exceed 4 KB.'); }
      }
      let body;
      try { body = JSON.parse(raw); } catch { throw error(400, 'Send valid JSON.'); }
      if (!body || Object.keys(body).sort().join(',') !== 'amountAtomic,paymentId' ||
          typeof body.paymentId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(body.paymentId) ||
          typeof body.amountAtomic !== 'string' || !/^[1-9][0-9]{0,8}$/.test(body.amountAtomic) || BigInt(body.amountAtomic) > 100_000_000n) {
        throw error(400, 'Send paymentId and amountAtomic as strings. The test limit is 100 USDT.');
      }
      const operation = queue.then(async () => {
        const old = read.get(body.paymentId);
        if (old) {
          if (old.amount !== body.amountAtomic) throw error(409, 'The payment ID already has a different amount.');
          const saved = JSON.parse(old.result);
          return [saved.status === 'unknown' ? 409 : 200, saved];
        }
        const saved = { paymentId: body.paymentId, assetId, amountAtomic: body.amountAtomic, status: 'unknown' };
        // Commit the uncertain state before the external wallet call. Never auto-repeat it.
        insert.run(body.paymentId, body.amountAtomic, JSON.stringify(saved));
        const receive = await issue(body.amountAtomic);
        Object.assign(saved, receive, { status: 'awaiting_payment' });
        update.run(JSON.stringify(saved), body.paymentId);
        return [201, saved];
      });
      queue = operation.catch(() => {});
      const [status, result] = await operation;
      reply(status, result);
    } catch (e) { reply(e.status || 503, { error: e.status ? e.message : 'The vault request failed. Reconcile this payment ID before retrying.' }); }
  });
  return { server, close: () => db.close() };
}

if (import.meta.main) {
  const databasePath = fileURLToPath(new URL('./wdk/data/vault.sqlite', import.meta.url));
  const app = createVaultServer({ token: process.env.VAULT_API_TOKEN, databasePath });
  app.server.listen(4001, '127.0.0.1', () => console.log('Private vault endpoint: http://127.0.0.1:4001/vault/deposits'));
  app.server.on('error', e => { console.error(e.message); app.close(); process.exitCode = 1; });
}
