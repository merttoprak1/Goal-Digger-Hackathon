import type { DatabaseSync } from "node:sqlite";
import { ApiError } from "../middlewares/error-handler.js";

export interface StakeSnapshot {
  paymentId: string;
  participantId: string;
  amountAtomic: string;
  assetId: string;
  txid: string;
  recipientId: string;
  creditedAt: string;
}
export interface BettingSnapshot {
  challengeId: string;
  creatorId: string;
  bettingCutoff: string;
  sealedAt: string;
  poolAtomic: string;
  opponentTotalAtomic: string;
  stakes: StakeSnapshot[];
  shares: Array<{
    participantId: string;
    stakeAtomic: string;
    numerator: string;
    denominator: string;
  }>;
}
interface FundingTerms {
  id: string;
  creatorId: string;
  creatorStakeAtomic: string;
  bettingCutoff: string;
}
export const fundingReview = () => {
  throw new ApiError(
    409,
    "The challenge funds need review before settlement.",
    "FUNDING_REVIEW",
  );
};
export function readFunding(db: DatabaseSync, challenge: FundingTerms): StakeSnapshot[] {
  if (
    !db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='stake_credits'",
      )
      .get()
  )
    return fundingReview();
  const deposits = db
    .prepare(
      "SELECT d.*,c.asset_id,c.txid,c.recipient_id,c.credited_at FROM stake_deposits d LEFT JOIN stake_credits c ON c.payment_id=d.payment_id WHERE d.challenge_id=? ORDER BY d.payment_id",
    )
    .all(challenge.id);
  const reserved = db
    .prepare("SELECT * FROM opponent_stakes WHERE challenge_id=?")
    .all(challenge.id);
  if (
    reserved.some(
      (r) =>
        !deposits.some(
          (d) =>
            d.payment_id === r.payment_id &&
            d.participant_id === r.participant_id &&
            d.amount === r.amount,
        ),
    )
  )
    fundingReview();
  const creator = deposits.find(
    (d) =>
      d.payment_id === `creator-${challenge.id}` &&
      d.participant_id === challenge.creatorId &&
      d.amount === challenge.creatorStakeAtomic,
  );
  if (!creator || deposits.length < 2) fundingReview();
  for (const d of deposits) {
    if (
      !d.credited_at ||
      !Number.isFinite(Date.parse(String(d.credited_at))) ||
      Date.parse(String(d.credited_at)) >= Date.parse(challenge.bettingCutoff)
    )
      fundingReview();
    if (
      d.asset_id !== "rgb:lX~ToKsO-Iup7dJ5-UM794sA-9WD21ge-VHYzBGb-E9PA_h0" ||
      !/^[1-9][0-9]{0,8}$/.test(String(d.amount)) ||
      BigInt(String(d.amount)) > 100000000n
    )
      fundingReview();
    if (
      d !== creator &&
      !reserved.some(
        (r) =>
          r.payment_id === d.payment_id &&
          r.participant_id === d.participant_id &&
          r.amount === d.amount &&
          r.participant_id !== challenge.creatorId,
      )
    )
      fundingReview();
  }
  return deposits.map((d) => ({
    paymentId: String(d.payment_id),
    participantId: String(d.participant_id),
    amountAtomic: String(d.amount),
    assetId: String(d.asset_id),
    txid: String(d.txid),
    recipientId: String(d.recipient_id),
    creditedAt: String(d.credited_at),
  }));
}
export function bettingBook(db: DatabaseSync, now: () => number) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS betting_snapshots(challenge_id TEXT PRIMARY KEY REFERENCES challenges(id),result TEXT NOT NULL)",
  );
  const getBettingSnapshot = (id: string): BettingSnapshot | null => {
    const row = db
      .prepare("SELECT result FROM betting_snapshots WHERE challenge_id=?")
      .get(id);
    return row ? JSON.parse(String(row.result)) : null;
  };
  // Caller holds the write transaction, including when finalizing an outcome.
  const sealInsideTransaction = (id: string) => {
    const row = db
      .prepare(
        "SELECT c.result FROM challenges c JOIN publications p ON p.challenge_id=c.id WHERE c.id=?",
      )
      .get(id);
    if (!row) throw new ApiError(404, "Published challenge not found.", "NOT_FOUND");
    const challenge = JSON.parse(String(row.result));
    if (now() < Date.parse(challenge.bettingCutoff))
      throw new ApiError(409, "Betting is still open.", "BETTING_OPEN");
    const stakes = readFunding(db, challenge);
    const previous = getBettingSnapshot(id);
    if (previous) {
      if (JSON.stringify(previous.stakes) !== JSON.stringify(stakes)) fundingReview();
      return previous;
    }
    const opponents = stakes.filter((s) => s.participantId !== challenge.creatorId);
    const opponentTotal = opponents.reduce(
      (total, s) => total + BigInt(s.amountAtomic),
      0n,
    );
    const snapshot: BettingSnapshot = {
      challengeId: id,
      creatorId: challenge.creatorId,
      bettingCutoff: challenge.bettingCutoff,
      sealedAt: new Date(now()).toISOString(),
      poolAtomic: stakes
        .reduce((total, s) => total + BigInt(s.amountAtomic), 0n)
        .toString(),
      opponentTotalAtomic: opponentTotal.toString(),
      stakes,
      shares: opponents.map((s) => ({
        participantId: s.participantId,
        stakeAtomic: s.amountAtomic,
        numerator: s.amountAtomic,
        denominator: opponentTotal.toString(),
      })),
    };
    db.prepare("INSERT INTO betting_snapshots VALUES(?,?)").run(
      id,
      JSON.stringify(snapshot),
    );
    return snapshot;
  };
  return {
    getBettingSnapshot,
    sealInsideTransaction,
    closeBetting(id: string) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const snapshot = sealInsideTransaction(id);
        db.exec("COMMIT");
        return snapshot;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}
