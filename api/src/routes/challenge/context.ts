import type { Response } from "express";
import { z } from "zod";
import type { StakeDeposits } from "../../../../vault/stake-deposits.mjs";
import { ApiError } from "../../middlewares/error-handler.js";
import type { vaultPayouts } from "../../services/vault-payouts.js";
import type { openSessions } from "../../store/sessions.js";
import type { ProofReview, ProofReviewInput } from "../../services/local-proof-reviewer.js";

export type SessionStore = ReturnType<typeof openSessions>;
export type PayoutVault = ReturnType<typeof vaultPayouts>;
export type ProofReviewer = (input: ProofReviewInput) => Promise<ProofReview>;

export interface ChallengeContext {
  store: SessionStore;
  stakes?: StakeDeposits;
  payoutVault?: PayoutVault;
  proofReviewer: ProofReviewer;
}

export function participantId(res: Response): string {
  return res.locals.participant.id;
}

export function requireEmptyBody(body: unknown, message: string, code: string): void {
  if (!body || Array.isArray(body) || typeof body !== "object" || Object.keys(body).length) {
    throw new ApiError(400, message, code);
  }
}

export function requireStrictEmpty(body: unknown, message: string, code: string): void {
  if (!z.object({}).strict().safeParse(body).success) {
    throw new ApiError(400, message, code);
  }
}

export function requireConfiguredStakes(stakes: StakeDeposits | undefined): StakeDeposits {
  if (!stakes) {
    throw new ApiError(503, "The vault connection is not configured.", "VAULT_UNAVAILABLE");
  }
  return stakes;
}

export function requireConfiguredVault(payoutVault: PayoutVault | undefined): PayoutVault {
  if (!payoutVault) {
    throw new ApiError(503, "The vault connection is not configured.", "VAULT_UNAVAILABLE");
  }
  return payoutVault;
}

export function requirePublished(store: SessionStore, id: string) {
  const challenge = store.getPublished(id);
  if (!challenge) {
    throw new ApiError(404, "Published challenge not found.", "NOT_FOUND");
  }
  return challenge;
}
