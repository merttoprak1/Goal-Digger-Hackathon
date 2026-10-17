import type { DatabaseSync } from "node:sqlite";
import { bettingBook, fundingReview, type BettingSnapshot } from "./betting.js";
import { awardClaims } from "./award-claims.js";
import { ApiError } from "../middlewares/error-handler.js";

export function allocatePool(snapshot: BettingSnapshot, status: "success" | "failure") {
  if (status === "success")
    return [{ participantId: snapshot.creatorId, amountAtomic: snapshot.poolAtomic }];
  const pool = BigInt(snapshot.poolAtomic);
  const total = BigInt(snapshot.opponentTotalAtomic);
  const rows = snapshot.shares.map((s) => ({
    participantId: s.participantId,
    amount: (pool * BigInt(s.stakeAtomic)) / total,
    remainder: (pool * BigInt(s.stakeAtomic)) % total,
  }));
  rows.sort((a, b) =>
    a.remainder === b.remainder
      ? a.participantId < b.participantId
        ? -1
        : a.participantId > b.participantId
          ? 1
          : 0
      : a.remainder > b.remainder
        ? -1
        : 1,
  );
  const remaining = pool - rows.reduce((sum, r) => sum + r.amount, 0n);
  rows.forEach((r, i) => {
    if (BigInt(i) < remaining) r.amount += 1n;
  });
  return rows
    .sort((a, b) =>
      a.participantId < b.participantId ? -1 : a.participantId > b.participantId ? 1 : 0,
    )
    .map((r) => ({ participantId: r.participantId, amountAtomic: r.amount.toString() }));
}
export function payoutPlans(
  db: DatabaseSync,
  now: () => number,
  book: ReturnType<typeof bettingBook>,
  getOutcome: (
    id: string,
  ) => { status: string; poolAtomic: string; stakes: unknown } | null,
) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS payout_plans(challenge_id TEXT PRIMARY KEY REFERENCES challenges(id),result TEXT NOT NULL)",
  );
  const getPayoutPlan = (id: string) => {
    const row = db
      .prepare("SELECT result FROM payout_plans WHERE challenge_id=?")
      .get(id);
    return row ? JSON.parse(String(row.result)) : null;
  };
  const checkedPlan = (id: string) => {
    const outcome = getOutcome(id);
    if (!outcome)
      throw new ApiError(
        409,
        "Finalize the challenge before calculating payouts.",
        "OUTCOME_REQUIRED",
      );
    const snapshot = book.sealInsideTransaction(id);
    if (
      snapshot.poolAtomic !== outcome.poolAtomic ||
      JSON.stringify(snapshot.stakes) !== JSON.stringify(outcome.stakes)
    )
      fundingReview();
    if (outcome.status !== "success" && outcome.status !== "failure")
      throw new ApiError(409, "The outcome is not final.", "OUTCOME_REQUIRED");
    const plan = getPayoutPlan(id);
    if (!plan)
      throw new ApiError(
        409,
        "Create the payout plan before submitting an invoice.",
        "PLAN_REQUIRED",
      );
    return plan;
  };
  return {
    getPayoutPlan,
    ...awardClaims(db, now, checkedPlan),
    createPayoutPlan(id: string) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const outcome = getOutcome(id);
        if (!outcome)
          throw new ApiError(
            409,
            "Finalize the challenge before calculating payouts.",
            "OUTCOME_REQUIRED",
          );
        const snapshot = book.sealInsideTransaction(id);
        if (
          snapshot.poolAtomic !== outcome.poolAtomic ||
          JSON.stringify(snapshot.stakes) !== JSON.stringify(outcome.stakes)
        )
          fundingReview();
        if (outcome.status !== "success" && outcome.status !== "failure")
          throw new ApiError(409, "The outcome is not final.", "OUTCOME_REQUIRED");
        const previous = getPayoutPlan(id);
        if (previous) {
          db.exec("COMMIT");
          return previous;
        }
        const plan = {
          challengeId: id,
          outcome: outcome.status,
          poolAtomic: snapshot.poolAtomic,
          assetId: snapshot.stakes[0]!.assetId,
          rounding: "largest_remainder_participant_id",
          allocations: allocatePool(snapshot, outcome.status),
          calculatedAt: new Date(now()).toISOString(),
        };
        db.prepare("INSERT INTO payout_plans VALUES(?,?)").run(id, JSON.stringify(plan));
        db.exec("COMMIT");
        return plan;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}
