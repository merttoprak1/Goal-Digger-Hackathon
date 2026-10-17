import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { timingSafeEqual } from "node:crypto";
import { validatePayoutInvoice } from "./payout-invoice.mjs";

const assetId = "rgb:lX~ToKsO-Iup7dJ5-UM794sA-9WD21ge-VHYzBGb-E9PA_h0";
const error = (status, message) => Object.assign(new Error(message), { status });
function issueInvoice(amountAtomic) {
  const cwd = fileURLToPath(new URL("./wdk/", import.meta.url));
  return new Promise((resolve, reject) =>
    execFile(
      `${cwd}/node_modules/.bin/bare`,
      ["check.mjs", "deposit", amountAtomic],
      { cwd, timeout: 60_000, maxBuffer: 65536 },
      (err, stdout) => {
        if (err) return reject(new Error("The WDK invoice request failed."));
        try {
          const body = JSON.parse(stdout);
          const receive = body.rgb?.receive;
          if (
            body.nativeNetwork !== "SignetCustom" ||
            body.rgb?.assetId !== assetId ||
            body.rgb?.amountAtomic !== amountAtomic ||
            typeof receive?.invoice !== "string" ||
            !receive.recipientId?.startsWith("sbc:wvout:") ||
            !Number.isInteger(receive.expirationTimestamp) ||
            receive.expirationTimestamp <= Date.now() / 1000
          )
            throw new Error();
          resolve({
            invoice: receive.invoice,
            recipientId: receive.recipientId,
            expirationTimestamp: receive.expirationTimestamp,
          });
        } catch {
          reject(new Error("WDK returned an invalid invoice."));
        }
      },
    ),
  );
}

function readDeposit(saved, mode = "deposit-status") {
  const cwd = fileURLToPath(new URL("./wdk/", import.meta.url));
  return new Promise((resolve, reject) =>
    execFile(
      `${cwd}/node_modules/.bin/bare`,
      ["check.mjs", mode, saved.recipientId],
      { cwd, timeout: 60_000, maxBuffer: 65536 },
      (err, stdout) => {
        if (err) return reject(new Error("The WDK status request failed."));
        try {
          const body = JSON.parse(stdout);
          if (
            body.nativeNetwork !== "SignetCustom" ||
            !Array.isArray(body.rgb?.transfers)
          )
            throw new Error();
          resolve(body.rgb);
        } catch {
          reject(new Error("WDK returned invalid transfer data."));
        }
      },
    ),
  );
}

export function assessDeposit(saved, snapshot) {
  if (snapshot?.assetId !== saved.assetId || !Array.isArray(snapshot.transfers))
    return { status: "unknown", txid: null };
  const matches = snapshot.transfers.filter(
    (t) => t.recipientId === saved.recipientId && t.kind === "ReceiveWitness",
  );
  if (!matches.length) return { status: "unknown", txid: null };
  if (matches.length !== 1) return { status: "review_required", txid: null };
  const transfer = matches[0];
  const txid =
    typeof transfer.txid === "string" && /^[a-f0-9]{64}$/.test(transfer.txid)
      ? transfer.txid
      : null;
  if (transfer.status === "Failed") return { status: "failed", txid };
  if (transfer.status === "WaitingCounterparty" && !txid && !transfer.assignments?.length)
    return { status: "awaiting_payment", txid: null };
  const assignments = transfer.assignments;
  if (
    !txid ||
    !Array.isArray(assignments) ||
    !assignments.length ||
    assignments.some(
      (a) =>
        !a ||
        Object.keys(a).join(",") !== "Fungible" ||
        !Number.isSafeInteger(a.Fungible) ||
        a.Fungible < 0,
    ) ||
    assignments.reduce((sum, a) => sum + BigInt(a.Fungible), 0n) !==
      BigInt(saved.amountAtomic)
  ) {
    return { status: "review_required", txid };
  }
  if (transfer.status === "Settled") return { status: "settled", txid };
  if (["WaitingBroadcast", "WaitingConfirmations"].includes(transfer.status))
    return { status: "pending", txid };
  return { status: "unknown", txid };
}

export function assessPayout(saved, snapshot) {
  const result = (status) => ({ status, txid: saved.txid });
  if (snapshot?.assetId !== saved.assetId || !Array.isArray(snapshot.transfers))
    return result("unknown");
  const matches = snapshot.transfers.filter(
    (t) => t.recipientId === saved.recipientId && t.kind === "Send",
  );
  if (!matches.length) return result("unknown");
  if (matches.length !== 1) return result("review_required");
  const transfer = matches[0];
  // Outgoing transfers have an empty assignments list. Check requestedAssignment instead.
  const assignment = transfer.requestedAssignment;
  if (
    typeof saved.txid !== "string" ||
    !/^[a-f0-9]{64}$/.test(saved.txid) ||
    transfer.txid !== saved.txid ||
    !assignment ||
    Object.keys(assignment).join(",") !== "Fungible" ||
    !Number.isSafeInteger(assignment.Fungible) ||
    String(assignment.Fungible) !== saved.amountAtomic
  )
    return result("review_required");
  if (transfer.status === "Settled") return result("settled");
  if (transfer.status === "Failed") return result("failed");
  if (
    ["WaitingCounterparty", "WaitingBroadcast", "WaitingConfirmations"].includes(
      transfer.status,
    )
  )
    return result("pending");
  return result("unknown");
}

function decodeInvoice(invoice) {
  const cwd = fileURLToPath(new URL("./wdk/", import.meta.url));
  return new Promise((resolve, reject) =>
    execFile(
      `${cwd}/node_modules/.bin/bare`,
      ["decode-invoice.mjs", invoice],
      { cwd, timeout: 10_000, maxBuffer: 65536 },
      (err, stdout) => {
        if (err) return reject(new Error("The invoice decoder is unavailable."));
        try {
          const result = JSON.parse(stdout);
          if (!Object.hasOwn(result, "decoded")) throw new Error();
          resolve(result.decoded);
        } catch {
          reject(new Error("The decoder returned an invalid response."));
        }
      },
    ),
  );
}

function sendPayout(saved) {
  const cwd = fileURLToPath(new URL("./wdk/", import.meta.url));
  const directory = `${cwd}data/custom-signet/payouts`;
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  // An existing journal requires reconciliation. Never overwrite it to retry a send.
  writeFileSync(`${directory}/${saved.payoutId}.json`, JSON.stringify(saved), {
    mode: 0o600,
    flag: "wx",
  });
  return new Promise((resolve, reject) =>
    execFile(
      `${cwd}/node_modules/.bin/bare`,
      ["check.mjs", "execute-payout", saved.payoutId],
      { cwd, timeout: 60_000, maxBuffer: 65536 },
      (err, stdout) => {
        if (err) return reject(new Error("The WDK payout result is uncertain."));
        try {
          const body = JSON.parse(stdout);
          const result = body.rgb;
          if (
            body.nativeNetwork !== "SignetCustom" ||
            result?.status !== "accepted" ||
            result.payoutId !== saved.payoutId ||
            result.assetId !== saved.assetId ||
            result.amountAtomic !== saved.amountAtomic ||
            result.recipientId !== saved.recipientId ||
            result.invoice !== saved.invoice ||
            !/^[a-f0-9]{64}$/.test(result.txid || "")
          )
            throw new Error();
          resolve({ txid: result.txid });
        } catch {
          reject(new Error("WDK returned an uncertain payout result."));
        }
      },
    ),
  );
}

export function createVaultServer({
  token,
  databasePath,
  issueInvoice: issue = issueInvoice,
  readDeposit: inspect = readDeposit,
  decodeInvoice: decode = decodeInvoice,
  executePayout: execute = sendPayout,
  readPayout: inspectPayout = (saved) => readDeposit(saved, "payout-status"),
}) {
  if (typeof token !== "string" || !token)
    throw new Error("Set VAULT_API_TOKEN before starting the vault.");
  mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(databasePath);
  chmodSync(databasePath, 0o600);
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS deposits (id TEXT PRIMARY KEY, amount TEXT NOT NULL, result TEXT NOT NULL)",
  );
  const read = db.prepare("SELECT amount, result FROM deposits WHERE id = ?");
  const insert = db.prepare("INSERT INTO deposits VALUES (?, ?, ?)");
  const update = db.prepare("UPDATE deposits SET result = ? WHERE id = ?");
  db.exec(
    "CREATE TABLE IF NOT EXISTS deposit_status (id TEXT PRIMARY KEY, result TEXT NOT NULL)",
  );
  const updateStatus = db.prepare(
    "INSERT INTO deposit_status (result, id) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET result = excluded.result",
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS payouts (id TEXT PRIMARY KEY, asset_id TEXT NOT NULL, recipient_id TEXT NOT NULL, result TEXT NOT NULL, UNIQUE(asset_id, recipient_id))",
  );
  const readPayout = db.prepare("SELECT result FROM payouts WHERE id = ?");
  const insertPayout = db.prepare(
    "INSERT INTO payouts VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING",
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS payout_attempts (id TEXT PRIMARY KEY, result TEXT NOT NULL)",
  );
  const readAttempt = db.prepare("SELECT result FROM payout_attempts WHERE id = ?");
  const claimAttempt = db.prepare(
    "INSERT INTO payout_attempts VALUES (?, ?) ON CONFLICT DO NOTHING",
  );
  const updateAttempt = db.prepare("UPDATE payout_attempts SET result = ? WHERE id = ?");
  const payoutResult = (saved) => ({
    ...saved,
    ...JSON.parse(readAttempt.get(saved.payoutId)?.result || "{}"),
  });
  db.exec(
    "CREATE TABLE IF NOT EXISTS payout_status (id TEXT PRIMARY KEY, result TEXT NOT NULL)",
  );
  const readPayoutStatus = db.prepare("SELECT result FROM payout_status WHERE id = ?");
  const savePayoutStatus = db.prepare(
    "INSERT INTO payout_status VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET result = excluded.result",
  );
  let queue = Promise.resolve();
  const server = createServer({ requestTimeout: 10_000 }, async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    const reply = (status, body) => res.writeHead(status).end(JSON.stringify(body));
    try {
      const supplied = Buffer.from(req.headers.authorization || "");
      const expected = Buffer.from(`Bearer ${token}`);
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
        throw error(401, "A valid vault token is required.");
      const payoutStatusMatch = /^\/vault\/payouts\/([a-zA-Z0-9_-]{1,80})\/status$/.exec(
        req.url || "",
      );
      if (payoutStatusMatch) {
        if (req.method !== "GET") {
          res.setHeader("Allow", "GET");
          throw error(405, "Use GET for this endpoint.");
        }
        const operation = queue.then(async () => {
          const old = readPayout.get(payoutStatusMatch[1]);
          if (!old) throw error(404, "Payout ID not found.");
          const saved = payoutResult(JSON.parse(old.result));
          if (saved.status !== "accepted" || !/^[a-f0-9]{64}$/.test(saved.txid || "")) {
            return { ...saved, executionStatus: saved.status, checkedAt: null };
          }
          const checked = {
            ...assessPayout(saved, await inspectPayout(saved)),
            checkedAt: new Date().toISOString(),
          };
          savePayoutStatus.run(saved.payoutId, JSON.stringify(checked));
          return { ...saved, ...checked, executionStatus: saved.status };
        });
        queue = operation.catch(() => {});
        reply(200, await operation);
        return;
      }
      const payoutMatch = /^\/vault\/payouts\/([a-zA-Z0-9_-]{1,80})$/.exec(req.url || "");
      if (payoutMatch && payoutMatch[1] !== "validate") {
        if (req.method !== "GET") {
          res.setHeader("Allow", "GET");
          throw error(405, "Use GET for this endpoint.");
        }
        const old = readPayout.get(payoutMatch[1]);
        if (!old) throw error(404, "Payout ID not found.");
        const settlement = readPayoutStatus.get(payoutMatch[1]);
        reply(200, {
          ...payoutResult(JSON.parse(old.result)),
          ...(settlement ? { settlement: JSON.parse(settlement.result) } : {}),
        });
        return;
      }
      const statusMatch = /^\/vault\/deposits\/([a-zA-Z0-9_-]{1,80})$/.exec(
        req.url || "",
      );
      if (statusMatch) {
        if (req.method !== "GET") {
          res.setHeader("Allow", "GET");
          throw error(405, "Use GET for this endpoint.");
        }
        const operation = queue.then(async () => {
          const old = read.get(statusMatch[1]);
          if (!old) throw error(404, "Payment ID not found.");
          const saved = JSON.parse(old.result);
          if (!saved.recipientId || !saved.invoice)
            return { ...saved, status: "unknown", txid: null };
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
      const payoutValidation = req.url === "/vault/payouts/validate";
      const payoutRequest = req.url === "/vault/payouts";
      const executionMatch = /^\/vault\/payouts\/([a-zA-Z0-9_-]{1,80})\/execute$/.exec(
        req.url || "",
      );
      if (
        req.url !== "/vault/deposits" &&
        !payoutValidation &&
        !payoutRequest &&
        !executionMatch
      )
        throw error(404, "Endpoint not found.");
      if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        throw error(405, "Use POST for this endpoint.");
      }
      if (req.headers["content-type"]?.split(";")[0].trim() !== "application/json")
        throw error(415, "Send Content-Type: application/json.");
      let raw = "";
      for await (const chunk of req.iterator({ destroyOnReturn: false })) {
        raw += chunk;
        if (Buffer.byteLength(raw) > 4096) {
          req.resume();
          throw error(413, "The request body must not exceed 4 KB.");
        }
      }
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        throw error(400, "Send valid JSON.");
      }
      if (executionMatch) {
        if (
          !body ||
          Array.isArray(body) ||
          typeof body !== "object" ||
          Object.keys(body).length
        )
          throw error(
            400,
            "Send an empty JSON object. Execution uses the saved payout details.",
          );
        const operation = queue.then(async () => {
          const old = readPayout.get(executionMatch[1]);
          if (!old) throw error(404, "Payout ID not found.");
          const saved = JSON.parse(old.result);
          const existing = readAttempt.get(saved.payoutId);
          if (existing) {
            const result = payoutResult(saved);
            return [result.status === "accepted" ? 200 : 409, result];
          }
          const validated = validatePayoutInvoice(
            await decode(saved.invoice),
            saved.amountAtomic,
          );
          if (!validated.valid) return [422, validated];
          if (
            validated.assetId !== saved.assetId ||
            validated.recipientId !== saved.recipientId
          )
            return [
              422,
              {
                valid: false,
                reason: "The decoded invoice differs from the saved payout.",
              },
            ];
          const attempt = {
            status: "unknown",
            attemptedAt: new Date().toISOString(),
            txid: null,
          };
          // SQLite commits the claim before WDK starts. An uncertain attempt cannot be retried.
          if (!claimAttempt.run(saved.payoutId, JSON.stringify(attempt)).changes) {
            const result = payoutResult(saved);
            return [result.status === "accepted" ? 200 : 409, result];
          }
          const transfer = await execute(saved);
          if (typeof transfer?.txid !== "string" || !/^[a-f0-9]{64}$/.test(transfer.txid))
            throw new Error("Uncertain payout transaction ID.");
          Object.assign(attempt, { status: "accepted", txid: transfer.txid });
          updateAttempt.run(JSON.stringify(attempt), saved.payoutId);
          return [200, { ...saved, ...attempt }];
        });
        queue = operation.catch(() => {});
        const [status, result] = await operation;
        reply(status, result);
        return;
      }
      if (payoutRequest) {
        if (
          !body ||
          Object.keys(body).sort().join(",") !==
            "amountAtomic,challengeId,invoice,participantId,payoutId" ||
          ["payoutId", "challengeId", "participantId"].some(
            (key) =>
              typeof body[key] !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(body[key]),
          ) ||
          body.payoutId === "validate" ||
          typeof body.invoice !== "string" ||
          !body.invoice.startsWith("rgb:") ||
          body.invoice.length > 3000 ||
          typeof body.amountAtomic !== "string" ||
          !/^[1-9][0-9]{0,8}$/.test(body.amountAtomic) ||
          BigInt(body.amountAtomic) > 100_000_000n
        ) {
          throw error(
            400,
            "Send payoutId, challengeId, participantId, invoice, and amountAtomic as strings. The test limit is 100 USDT.",
          );
        }
        const operation = queue.then(async () => {
          const old = readPayout.get(body.payoutId);
          if (old) {
            const saved = JSON.parse(old.result);
            if (Object.keys(body).some((key) => saved[key] !== body[key]))
              throw error(409, "The payout ID already has different details.");
            return [200, saved];
          }
          const validated = validatePayoutInvoice(
            await decode(body.invoice),
            body.amountAtomic,
          );
          if (!validated.valid) return [422, validated];
          const saved = {
            ...body,
            assetId: validated.assetId,
            recipientId: validated.recipientId,
            expirationTimestamp: validated.expirationTimestamp,
            status: "prepared",
            createdAt: new Date().toISOString(),
          };
          // Saving a request does not reserve funds or execute a transfer.
          const inserted = insertPayout.run(
            body.payoutId,
            saved.assetId,
            saved.recipientId,
            JSON.stringify(saved),
          );
          if (!inserted.changes)
            throw error(
              409,
              "The payout ID or RGB recipient already belongs to a saved payout.",
            );
          return [201, saved];
        });
        queue = operation.catch(() => {});
        const [status, result] = await operation;
        reply(status, result);
        return;
      }
      if (payoutValidation) {
        if (
          !body ||
          Object.keys(body).sort().join(",") !== "amountAtomic,invoice" ||
          typeof body.invoice !== "string" ||
          !body.invoice.startsWith("rgb:") ||
          body.invoice.length > 3000 ||
          typeof body.amountAtomic !== "string" ||
          !/^[1-9][0-9]{0,8}$/.test(body.amountAtomic) ||
          BigInt(body.amountAtomic) > 100_000_000n
        ) {
          throw error(
            400,
            "Send an RGB invoice and amountAtomic as strings. The test limit is 100 USDT.",
          );
        }
        const result = validatePayoutInvoice(
          await decode(body.invoice),
          body.amountAtomic,
        );
        reply(result.valid ? 200 : 422, result);
        return;
      }
      if (
        !body ||
        Object.keys(body).sort().join(",") !== "amountAtomic,paymentId" ||
        typeof body.paymentId !== "string" ||
        !/^[a-zA-Z0-9_-]{1,80}$/.test(body.paymentId) ||
        typeof body.amountAtomic !== "string" ||
        !/^[1-9][0-9]{0,8}$/.test(body.amountAtomic) ||
        BigInt(body.amountAtomic) > 100_000_000n
      ) {
        throw error(
          400,
          "Send paymentId and amountAtomic as strings. The test limit is 100 USDT.",
        );
      }
      const operation = queue.then(async () => {
        const old = read.get(body.paymentId);
        if (old) {
          if (old.amount !== body.amountAtomic)
            throw error(409, "The payment ID already has a different amount.");
          const saved = JSON.parse(old.result);
          return [saved.status === "unknown" ? 409 : 200, saved];
        }
        const saved = {
          paymentId: body.paymentId,
          assetId,
          amountAtomic: body.amountAtomic,
          status: "unknown",
        };
        // Commit the uncertain state before the external wallet call. Never auto-repeat it.
        insert.run(body.paymentId, body.amountAtomic, JSON.stringify(saved));
        const receive = await issue(body.amountAtomic);
        Object.assign(saved, receive, { status: "awaiting_payment" });
        update.run(JSON.stringify(saved), body.paymentId);
        return [201, saved];
      });
      queue = operation.catch(() => {});
      const [status, result] = await operation;
      reply(status, result);
    } catch (e) {
      reply(e.status || 503, {
        error: e.status
          ? e.message
          : "The vault request failed. Check its saved record before retrying.",
      });
    }
  });
  return { server, close: () => db.close() };
}

if (import.meta.main) {
  const databasePath = fileURLToPath(new URL("./wdk/data/vault.sqlite", import.meta.url));
  const app = createVaultServer({ token: process.env.VAULT_API_TOKEN, databasePath });
  app.server.listen(4001, "127.0.0.1", () =>
    console.log("Private vault endpoint: http://127.0.0.1:4001/vault/deposits"),
  );
  app.server.on("error", (e) => {
    console.error(e.message);
    app.close();
    process.exitCode = 1;
  });
}
