import { allocatePool } from "../../store/payout-plans.js";
import type { SessionStore } from "./context.js";

interface Credit {
  participantId: string;
  amountAtomic: string;
  creditedAt: string;
}

export function prizeShares(
  store: SessionStore,
  challenge: { id: string; creatorId: string; bettingCutoff: string; proofDeadline: string },
) {
  const credits = (store.listStakeCredits(challenge.id) as Credit[]).filter(
    (credit) => Date.parse(credit.creditedAt) < Date.parse(challenge.bettingCutoff),
  );
  const totals = new Map<string, bigint>();
  for (const credit of credits) {
    const amount = BigInt(credit.amountAtomic);
    totals.set(credit.participantId, (totals.get(credit.participantId) ?? 0n) + amount);
  }
  const opponents = [...totals.entries()].filter(([id]) => id !== challenge.creatorId);
  const opponentTotal = opponents.reduce((sum, [, amount]) => sum + amount, 0n);
  const pool = [...totals.values()].reduce((sum, amount) => sum + amount, 0n);
  const snapshot = {
    challengeId: challenge.id,
    creatorId: challenge.creatorId,
    bettingCutoff: challenge.bettingCutoff,
    sealedAt: new Date().toISOString(),
    poolAtomic: pool.toString(),
    opponentTotalAtomic: opponentTotal.toString(),
    stakes: [...totals.entries()].map(([participantId, amount]) => ({
      participantId,
      amountAtomic: amount.toString(),
      assetId: "test-usdt",
      paymentId: participantId,
      txid: "",
      recipientId: "",
      creditedAt: challenge.bettingCutoff,
    })),
    shares: opponents.map(([participantId, amount]) => ({
      participantId,
      stakeAtomic: amount.toString(),
      numerator: amount.toString(),
      denominator: opponentTotal.toString(),
    })),
  };
  const named = (rows: Array<{ participantId: string; amountAtomic: string }>) =>
    rows.map((row) => ({
      participantId: row.participantId,
      displayName: store.nameOf(row.participantId),
      amountAtomic: row.amountAtomic,
      role: row.participantId === challenge.creatorId ? "creator" : "opponent",
    }));
  return {
    poolAtomic: pool.toString(),
    proofDeadline: challenge.proofDeadline,
    rule: "If the creator proves the goal, the creator receives the pool. If not, opponents share the pool in proportion to their stakes. WDK pays each share.",
    success: named([{ participantId: challenge.creatorId, amountAtomic: pool.toString() }]),
    failure: opponentTotal === 0n ? [] : named(allocatePool(snapshot, "failure")),
  };
}
