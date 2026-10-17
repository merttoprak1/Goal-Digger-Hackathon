import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname } from "node:path";

const assetId = "rgb:lX~ToKsO-Iup7dJ5-UM794sA-9WD21ge-VHYzBGb-E9PA_h0";
const validId = (value) =>
  typeof value === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(value);

// Backend-only adapter. The caller owns challenge eligibility and cutoff rules.
export function openStakeDeposits({ databasePath, token, fetchService = fetch }) {
  if (typeof token !== "string" || !token)
    throw new Error("A private vault token is required.");
  mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(databasePath);
  chmodSync(databasePath, 0o600);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
    CREATE TABLE IF NOT EXISTS stake_deposits (
      payment_id TEXT PRIMARY KEY, challenge_id TEXT NOT NULL, participant_id TEXT NOT NULL,
      amount TEXT NOT NULL, invoice TEXT
    );
    CREATE TABLE IF NOT EXISTS stake_credits (
      payment_id TEXT PRIMARY KEY, asset_id TEXT NOT NULL, txid TEXT NOT NULL,
      recipient_id TEXT NOT NULL, credited_at TEXT NOT NULL,
      UNIQUE(asset_id, txid, recipient_id)
    );`);
  const read = db.prepare("SELECT * FROM stake_deposits WHERE payment_id = ?");
  const readCredit = db.prepare("SELECT * FROM stake_credits WHERE payment_id = ?");
  const credit = (row) => ({
    paymentId: row.payment_id,
    challengeId: row.challenge_id,
    participantId: row.participant_id,
    amountAtomic: row.amount,
    assetId: row.asset_id,
    txid: row.txid,
    recipientId: row.recipient_id,
    creditedAt: row.credited_at,
  });
  const credits =
    db.prepare(`SELECT d.*, c.asset_id, c.txid, c.recipient_id, c.credited_at
    FROM stake_deposits d JOIN stake_credits c ON d.payment_id = c.payment_id WHERE d.challenge_id = ? ORDER BY d.payment_id`);
  async function call(path, body) {
    const response = await fetchService(`http://127.0.0.1:4001/vault/deposits${path}`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(70_000),
    });
    if (!response.ok)
      throw new Error(`The private vault returned HTTP ${response.status}.`);
    return response.json();
  }
  function checkInvoice(result, row) {
    if (
      result?.paymentId !== row.payment_id ||
      result.assetId !== assetId ||
      result.amountAtomic !== row.amount ||
      typeof result.invoice !== "string" ||
      !result.invoice.startsWith("rgb:") ||
      typeof result.recipientId !== "string" ||
      !result.recipientId.startsWith("sbc:wvout:")
    ) {
      throw new Error("The vault response does not match the bound stake.");
    }
  }
  return {
    async health() {
      try {
        const response = await fetchService("http://127.0.0.1:4001/health", {
          method: "GET",
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          signal: AbortSignal.timeout(3000),
        });
        if (!response.ok) return false;
        const body = await response.json().catch(() => null);
        return body?.status === "ok";
      } catch {
        return false;
      }
    },
    getInvoice(paymentId) {
      if (!validId(paymentId)) throw new Error("Invalid payment ID.");
      const row = read.get(paymentId);
      return row?.invoice ? JSON.parse(row.invoice) : null;
    },
    async bind(binding) {
      if (
        !binding ||
        Object.keys(binding).sort().join(",") !==
          "amountAtomic,challengeId,participantId,paymentId" ||
        ![binding.paymentId, binding.challengeId, binding.participantId].every(validId) ||
        typeof binding.amountAtomic !== "string" ||
        !/^[1-9][0-9]{0,8}$/.test(binding.amountAtomic) ||
        BigInt(binding.amountAtomic) > 100_000_000n
      ) {
        throw new Error(
          "Supply valid payment, challenge, participant, and atomic amount fields.",
        );
      }
      db.prepare("INSERT OR IGNORE INTO stake_deposits VALUES (?, ?, ?, ?, NULL)").run(
        binding.paymentId,
        binding.challengeId,
        binding.participantId,
        binding.amountAtomic,
      );
      const row = read.get(binding.paymentId);
      if (
        row.challenge_id !== binding.challengeId ||
        row.participant_id !== binding.participantId ||
        row.amount !== binding.amountAtomic
      ) {
        throw new Error("This payment ID already belongs to a different stake.");
      }
      if (row.invoice) return JSON.parse(row.invoice);
      // The vault owns invoice retry protection. A lost response reuses the same payment ID.
      const result = await call("", {
        paymentId: binding.paymentId,
        amountAtomic: binding.amountAtomic,
      });
      checkInvoice(result, row);
      if (result.status !== "awaiting_payment")
        throw new Error("The vault did not return a usable invoice.");
      db.prepare(
        "UPDATE stake_deposits SET invoice = COALESCE(invoice, ?) WHERE payment_id = ?",
      ).run(JSON.stringify(result), binding.paymentId);
      return { ...JSON.parse(read.get(binding.paymentId).invoice), fresh: true };
    },
    async confirm(paymentId) {
      if (!validId(paymentId)) throw new Error("Invalid payment ID.");
      const row = read.get(paymentId);
      if (!row?.invoice)
        throw new Error("Bind this payment to a stake and invoice first.");
      const oldCredit = readCredit.get(paymentId);
      if (oldCredit)
        return {
          status: "credited",
          newlyCredited: false,
          credit: credit({ ...row, ...oldCredit }),
        };
      const invoice = JSON.parse(row.invoice);
      const result = await call(`/${paymentId}`);
      checkInvoice(result, row);
      if (
        result.recipientId !== invoice.recipientId ||
        result.invoice !== invoice.invoice
      )
        throw new Error("The deposit recipient changed.");
      if (
        ![
          "awaiting_payment",
          "pending",
          "settled",
          "failed",
          "review_required",
          "unknown",
        ].includes(result.status)
      )
        throw new Error("The vault returned an invalid status.");
      if (result.status !== "settled")
        return { status: result.status, newlyCredited: false, credit: null };
      if (typeof result.txid !== "string" || !/^[a-f0-9]{64}$/.test(result.txid))
        throw new Error("The settled deposit has no valid transaction ID.");
      // No await occurs inside this transaction. Concurrent checks cannot create two credits.
      db.exec("BEGIN IMMEDIATE");
      try {
        const existing = readCredit.get(paymentId);
        if (existing) {
          db.exec("COMMIT");
          return {
            status: "credited",
            newlyCredited: false,
            credit: credit({ ...row, ...existing }),
          };
        }
        if (
          db
            .prepare(
              "SELECT payment_id FROM stake_credits WHERE asset_id = ? AND txid = ? AND recipient_id = ?",
            )
            .get(assetId, result.txid, result.recipientId)
        ) {
          throw new Error(
            "This transfer receipt is already credited to another payment ID.",
          );
        }
        db.prepare("INSERT INTO stake_credits VALUES (?, ?, ?, ?, ?)").run(
          paymentId,
          assetId,
          result.txid,
          result.recipientId,
          new Date().toISOString(),
        );
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
      return {
        status: "credited",
        newlyCredited: true,
        credit: credit({ ...row, ...readCredit.get(paymentId) }),
      };
    },
    listCredits(challengeId) {
      if (!validId(challengeId)) throw new Error("Invalid challenge ID.");
      return credits.all(challengeId).map(credit);
    },
    close: () => db.close(),
  };
}
