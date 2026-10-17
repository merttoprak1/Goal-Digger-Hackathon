import type { Router } from "express";
import { z } from "zod";
import { ApiError } from "../../middlewares/error-handler.js";
import {
  participantId,
  requireConfiguredVault,
  requirePublished,
  requireStrictEmpty,
  type ChallengeContext,
} from "./context.js";

const invoiceBody = z
  .object({ invoice: z.string().startsWith("rgb:").min(5).max(3000) })
  .strict();

export function registerSettlementRoutes(router: Router, context: ChallengeContext): void {
  const { store, proofReviewer } = context;
  const activeProofReviews = new Set<string>();

  router.post("/:id/proof-note", async (req, res) => {
    const id = String(req.params.id);
    const challenge = store.getChallenge(participantId(res), id);
    if (!challenge) throw new ApiError(404, "Challenge not found.", "NOT_FOUND");
    if (challenge.template !== "custom" || challenge.proofMethod !== "custom") {
      throw new ApiError(409, "This challenge does not use a written proof.", "WRONG_PROOF_METHOD");
    }
    const parsed = z
      .object({ statement: z.string().trim().min(3).max(1000) })
      .strict()
      .safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "Send a proof statement of 3 to 1000 characters.", "INVALID_PROOF");
    }
    const statement = parsed.data.statement;
    const existingReview = store.getProofReview(id);
    const retriesPendingEvidence =
      existingReview?.reviewVerdict === "pending" && existingReview.statement === statement;
    const repeatsAcceptedEvidence =
      existingReview?.reviewVerdict === "accepted" && existingReview.statement === statement;
    if (
      Date.now() >= Date.parse(challenge.proofDeadline) &&
      !retriesPendingEvidence &&
      !repeatsAcceptedEvidence
    ) {
      throw new ApiError(409, "The proof deadline has passed.", "PROOF_WINDOW_CLOSED");
    }
    const attempt = store.beginProofReview(id, statement);
    if (attempt.status === "accepted") {
      res.json({ saved: true, review: attempt.review });
      return;
    }
    if (activeProofReviews.has(id)) {
      throw new ApiError(
        409,
        "Goaly is already reviewing this proof. Retry the same evidence after that request finishes.",
        "PROOF_REVIEW_PENDING",
      );
    }
    activeProofReviews.add(id);
    try {
      const review = await proofReviewer({
        challengeId: id,
        proofMethod: "custom",
        successRule: challenge.successRule,
        evidence: statement,
      });
      if (review.verdict === "unclear") {
        store.clearPendingProofReview(id, statement, attempt.submittedAt);
        throw new ApiError(
          422,
          "Goaly could not assess this evidence clearly. Submit clearer proof while the proof window is open.",
          "PROOF_REVIEW_UNCLEAR",
        );
      }
      const recordedReview = {
        ...review,
        verdict: review.verdict === "accepted" ? "accepted" as const : "rejected" as const,
      };
      const saved = store.saveProofNote(id, statement, attempt.submittedAt, recordedReview);
      res.json({ saved: true, review: saved.review });
    } finally {
      activeProofReviews.delete(id);
    }
  });

  router.post("/:id/finalize", (req, res) => {
    const id = String(req.params.id);
    requirePublished(store, id);
    requireStrictEmpty(req.body, "Send an empty JSON object.", "INVALID_OUTCOME");
    res.json({ outcome: store.finalizeOutcome(id) });
  });

  router.get("/:id/outcome", (req, res) => {
    const id = String(req.params.id);
    requirePublished(store, id);
    res.json({ outcome: store.getOutcome(id) });
  });

  router.post("/:id/close-betting", (req, res) => {
    const id = String(req.params.id);
    requirePublished(store, id);
    requireStrictEmpty(req.body, "Send an empty JSON object.", "INVALID_SNAPSHOT");
    res.json({ snapshot: store.closeBetting(id) });
  });

  router.get("/:id/betting-snapshot", (req, res) => {
    const id = String(req.params.id);
    requirePublished(store, id);
    res.json({ snapshot: store.getBettingSnapshot(id) });
  });

  router.post("/:id/payout-plan", (req, res) => {
    const id = String(req.params.id);
    requirePublished(store, id);
    requireStrictEmpty(req.body, "Send an empty JSON object.", "INVALID_PAYOUT_PLAN");
    res.json({ plan: store.createPayoutPlan(id) });
  });

  router.get("/:id/payout-plan", (req, res) => {
    const id = String(req.params.id);
    requirePublished(store, id);
    res.json({ plan: store.getPayoutPlan(id) });
  });

  router.post("/:id/payout-request", async (req, res) => {
    const id = String(req.params.id);
    const ownerId = participantId(res);
    requirePublished(store, id);
    const parsed = invoiceBody.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "Send only the RGB receive invoice.", "INVALID_INVOICE");
    }
    const award = store.awardAllocation(id, ownerId);
    let claim = store.getAwardClaim(id, ownerId);
    if (claim && claim.invoice !== parsed.data.invoice) {
      throw new ApiError(409, "This award already has a different invoice.", "AWARD_BOUND");
    }
    if (claim?.payout) {
      res.json({ claim });
      return;
    }
    const payoutVault = requireConfiguredVault(context.payoutVault);
    if (!claim) {
      const validation = await payoutVault.validate(
        parsed.data.invoice,
        award.amountAtomic,
        award.assetId,
      );
      claim = store.bindAward(id, ownerId, parsed.data.invoice, validation);
    }
    const payout = await payoutVault.prepare(
      {
        payoutId: claim.payoutId,
        challengeId: id,
        participantId: ownerId,
        amountAtomic: claim.amountAtomic,
        invoice: claim.invoice,
      },
      claim.validation,
    );
    res.json({ claim: store.completeAward(id, ownerId, payout) });
  });

  router.get("/:id/payout-request", (req, res) => {
    const id = String(req.params.id);
    requirePublished(store, id);
    res.json({ claim: store.getAwardClaim(id, participantId(res)) });
  });

  router.post("/:id/payout-execution", async (req, res) => {
    const id = String(req.params.id);
    const ownerId = participantId(res);
    requirePublished(store, id);
    requireStrictEmpty(req.body, "Send an empty JSON object.", "INVALID_EXECUTION");
    const payoutVault = requireConfiguredVault(context.payoutVault);
    const attempt = store.beginAwardExecution(id, ownerId);
    if (attempt.execution.status === "accepted") {
      res.json({ execution: attempt.execution });
      return;
    }
    const receipt = await payoutVault.execute(attempt.claim.payout!);
    const execution = store.completeAwardExecution(id, ownerId, receipt);
    res.status(execution.status === "accepted" ? 200 : 409).json({ execution });
  });

  router.get("/:id/payout-execution", (req, res) => {
    const id = String(req.params.id);
    requirePublished(store, id);
    res.json({ execution: store.getAwardExecution(id, participantId(res)) });
  });
}
