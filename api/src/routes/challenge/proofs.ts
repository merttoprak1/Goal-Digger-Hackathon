import type { Router } from "express";
import { z } from "zod";
import { ApiError } from "../../middlewares/error-handler.js";
import {
  participantId,
  requireEmptyBody,
  type ChallengeContext,
} from "./context.js";
import { projectChallenge } from "./projection.js";

const answerBody = z
  .object({
    problemId: z.string().min(1).max(80),
    answer: z.string().regex(/^-?\d{1,6}$/),
  })
  .strict();

export function registerProofRoutes(router: Router, { store }: ChallengeContext): void {
  router.post("/:id/math/problem", (req, res) => {
    const challenge = ownedMathChallenge(store, participantId(res), String(req.params.id));
    requireEmptyBody(req.body, "Send an empty JSON object.", "INVALID_PROBLEM");
    requireOpenProofWindow(store, challenge);
    if (store.mathAccepted(challenge.id)) {
      throw new ApiError(409, "This challenge already has an accepted proof.", "PROOF_ACCEPTED");
    }
    const problem = store.createMathProblem(challenge.id);
    res.json({ problem: { ...problem, expiresAt: challenge.proofDeadline } });
  });

  router.post("/:id/math/submit", (req, res) => {
    const challenge = ownedMathChallenge(store, participantId(res), String(req.params.id));
    const parsed = answerBody.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "Send only problemId and an integer answer string.", "INVALID_ANSWER");
    }
    const previous = store.getMathReceipt(challenge.id, parsed.data.problemId);
    if (previous) {
      if (previous.answer !== parsed.data.answer) {
        throw new ApiError(409, "This problem already has a submitted answer.", "PROBLEM_USED");
      }
      res.json({ proof: previous.proof });
      return;
    }
    requireOpenProofWindow(store, challenge);
    res.json({
      proof: store.submitMath(challenge.id, parsed.data.problemId, parsed.data.answer),
    });
  });

  router.get("/:id/proofs", (req, res) => {
    const challenge = ownedMathChallenge(store, participantId(res), String(req.params.id));
    res.json({
      proofs: store.listMathProofs(challenge.id),
      accepted: store.mathAccepted(challenge.id),
    });
  });
}

function ownedMathChallenge(store: ChallengeContext["store"], ownerId: string, id: string) {
  const challenge = store.getChallenge(ownerId, id);
  if (!challenge) throw new ApiError(404, "Challenge not found.", "NOT_FOUND");
  if (challenge.template !== "wake_up" || challenge.proofMethod !== "timed_math") {
    throw new ApiError(409, "This challenge does not use timed math proof.", "WRONG_PROOF_METHOD");
  }
  return challenge;
}

function requireOpenProofWindow(
  store: ChallengeContext["store"],
  challenge: {
    id: string;
    creatorId: string;
    bettingCutoff: string;
    startsAt: string;
    creatorStakeAtomic: string;
    proofDeadline: string;
  },
): void {
  const view = projectChallenge(store, challenge);
  if (!view.publishedAt || view.reviewRequired) {
    throw new ApiError(
      409,
      "The challenge must be published and free from funding review.",
      "PROOF_BLOCKED",
    );
  }
  const now = Date.now();
  if (now < Date.parse(challenge.startsAt) || now >= Date.parse(challenge.proofDeadline)) {
    throw new ApiError(409, "The proof window is not open.", "PROOF_WINDOW_CLOSED");
  }
}
