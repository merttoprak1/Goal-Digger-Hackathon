import type { Router } from "express";
import { ApiError } from "../../middlewares/error-handler.js";
import { participantId, type ChallengeContext } from "./context.js";

interface StakeCredit {
  paymentId: string;
  participantId: string;
  amountAtomic: string;
  assetId: string;
  txid: string;
  recipientId: string;
  creditedAt: string;
}

export function registerLedgerRoutes(router: Router, { store }: ChallengeContext): void {
  router.get("/:id/ledger", (req, res) => {
    const id = String(req.params.id);
    const challenge = store.getChallenge(participantId(res), id) ?? store.getPublished(id);
    if (!challenge) throw new ApiError(404, "Challenge not found.", "NOT_FOUND");

    const credits = store.listStakeCredits(challenge.id) as StakeCredit[];
    const entries = credits.map((credit) => ({
      participantId: credit.participantId,
      participant: store.nameOf(credit.participantId),
      role: credit.participantId === challenge.creatorId ? "creator" : "opponent",
      amountAtomic: credit.amountAtomic,
      assetId: credit.assetId,
      txid: credit.txid,
      creditedAt: credit.creditedAt,
      eligible: Date.parse(credit.creditedAt) < Date.parse(challenge.bettingCutoff),
    }));
    const confirmedPoolAtomic = entries.reduce(
      (sum, entry) => sum + BigInt(entry.amountAtomic),
      0n,
    );
    const eligiblePoolAtomic = entries
      .filter((entry) => entry.eligible)
      .reduce((sum, entry) => sum + BigInt(entry.amountAtomic), 0n);

    res.json({
      challengeId: challenge.id,
      confirmedPoolAtomic: confirmedPoolAtomic.toString(),
      eligiblePoolAtomic: eligiblePoolAtomic.toString(),
      entries,
    });
  });
}
