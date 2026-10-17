import type { Router } from "express";
import { z } from "zod";
import { ApiError } from "../../middlewares/error-handler.js";
import {
  participantId,
  requireConfiguredStakes,
  requireEmptyBody,
  type ChallengeContext,
} from "./context.js";
import { projectChallenge } from "./projection.js";

const stakeBody = z
  .object({
    amountAtomic: z
      .string()
      .regex(/^[1-9][0-9]{0,8}$/)
      .refine((value) => /^[1-9][0-9]{0,8}$/.test(value) && BigInt(value) <= 100_000_000n),
  })
  .strict();

export function registerFundingRoutes(router: Router, context: ChallengeContext): void {
  const { store } = context;

  router.post("/:id/creator-deposit", async (req, res) => {
    const challenge = ownedChallenge(store, participantId(res), String(req.params.id));
    requireEmptyBody(
      req.body,
      "Send an empty JSON object. The draft sets the stake.",
      "INVALID_DEPOSIT",
    );
    const stakes = requireConfiguredStakes(context.stakes);
    const paymentId = `creator-${challenge.id}`;
    const existing = stakes.getInvoice(paymentId);
    if (existing) {
      res.json(existing);
      return;
    }
    if (Date.now() >= Date.parse(challenge.bettingCutoff)) {
      throw new ApiError(
        409,
        "The betting cutoff passed. Create a new draft before funding.",
        "FUNDING_CLOSED",
      );
    }
    try {
      res.json(
        await stakes.bind({
          paymentId,
          challengeId: challenge.id,
          participantId: participantId(res),
          amountAtomic: challenge.creatorStakeAtomic,
        }),
      );
    } catch {
      throw new ApiError(
        503,
        "The vault deposit request failed. Retry the same challenge to check its saved invoice.",
        "VAULT_UNAVAILABLE",
      );
    }
  });

  router.get("/:id/creator-deposit", async (req, res) => {
    const challenge = ownedChallenge(store, participantId(res), String(req.params.id));
    const stakes = requireConfiguredStakes(context.stakes);
    const paymentId = `creator-${challenge.id}`;
    if (!stakes.getInvoice(paymentId)) {
      throw new ApiError(409, "Create the deposit invoice first.", "DEPOSIT_NOT_CREATED");
    }
    try {
      const result = await stakes.confirm(paymentId);
      const late =
        result.credit &&
        Date.parse(result.credit.creditedAt) >= Date.parse(challenge.bettingCutoff);
      res.json({
        ...result,
        status: late ? "review_required" : result.status,
        confirmedPoolAtomic: projectChallenge(store, challenge).confirmedPoolAtomic,
        eligibleToOpen:
          result.status === "credited" &&
          !late &&
          Date.now() < Date.parse(challenge.bettingCutoff),
      });
    } catch {
      throw new ApiError(
        503,
        "The vault status is unavailable. No new stake credit was confirmed.",
        "VAULT_UNAVAILABLE",
      );
    }
  });

  router.post("/:id/publish", (req, res) => {
    const challenge = ownedChallenge(store, participantId(res), String(req.params.id));
    requireEmptyBody(req.body, "Send an empty JSON object.", "INVALID_PUBLICATION");
    if (store.publication(challenge.id)) {
      res.json({ challenge: projectChallenge(store, challenge) });
      return;
    }
    const view = projectChallenge(store, challenge);
    if (view.status !== "funded" || Date.now() >= Date.parse(challenge.bettingCutoff)) {
      throw new ApiError(
        409,
        "Confirm the creator stake before publishing and before the betting cutoff.",
        "PUBLICATION_BLOCKED",
      );
    }
    store.publish(challenge.id);
    res.json({ challenge: projectChallenge(store, challenge) });
  });

  router.post("/:id/opponent-deposit", async (req, res) => {
    const challenge = publishedChallenge(store, String(req.params.id));
    const opponentId = participantId(res);
    if (opponentId === challenge.creatorId) {
      throw new ApiError(409, "The creator cannot bet against this challenge.", "SELF_BET");
    }
    const parsed = stakeBody.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(
        400,
        "Send only a positive amountAtomic string. The test limit is 100 USDT.",
        "INVALID_STAKE",
      );
    }
    const stakes = requireConfiguredStakes(context.stakes);
    const binding = store.getOpponentStake(challenge.id, opponentId);
    if (binding && binding.amountAtomic !== parsed.data.amountAtomic) {
      throw new ApiError(
        409,
        "This participant already has a different stake amount.",
        "STAKE_CONFLICT",
      );
    }
    const existing = binding ? stakes.getInvoice(binding.paymentId) : null;
    if (existing) {
      res.json(existing);
      return;
    }
    if (projectChallenge(store, challenge).status !== "open") {
      throw new ApiError(409, "Betting is closed or the challenge needs review.", "BETTING_CLOSED");
    }
    const savedStake = store.bindOpponentStake(
      challenge.id,
      opponentId,
      parsed.data.amountAtomic,
    );
    if (savedStake.amountAtomic !== parsed.data.amountAtomic) {
      throw new ApiError(409, "The saved stake has a different amount.", "STAKE_CONFLICT");
    }
    try {
      res.json(
        await stakes.bind({
          paymentId: savedStake.paymentId,
          amountAtomic: savedStake.amountAtomic,
          challengeId: challenge.id,
          participantId: opponentId,
        }),
      );
    } catch {
      throw new ApiError(
        503,
        "The opponent invoice request is unavailable. Retry this same stake.",
        "VAULT_UNAVAILABLE",
      );
    }
  });

  router.get("/:id/opponent-deposit", async (req, res) => {
    const challenge = publishedChallenge(store, String(req.params.id));
    const stakes = requireConfiguredStakes(context.stakes);
    const binding = store.getOpponentStake(challenge.id, participantId(res));
    if (!binding || !stakes.getInvoice(binding.paymentId)) {
      throw new ApiError(409, "Create an opponent invoice first.", "DEPOSIT_NOT_CREATED");
    }
    try {
      const result = await stakes.confirm(binding.paymentId);
      const late =
        result.credit &&
        Date.parse(result.credit.creditedAt) >= Date.parse(challenge.bettingCutoff);
      const view = projectChallenge(store, challenge);
      res.json({
        ...result,
        status: late ? "review_required" : result.status,
        confirmedPoolAtomic: view.confirmedPoolAtomic,
        eligiblePoolAtomic: view.eligiblePoolAtomic,
      });
    } catch {
      throw new ApiError(503, "The opponent deposit status is unavailable.", "VAULT_UNAVAILABLE");
    }
  });
}

function ownedChallenge(store: ChallengeContext["store"], ownerId: string, id: string) {
  const challenge = store.getChallenge(ownerId, id);
  if (!challenge) throw new ApiError(404, "Challenge not found.", "NOT_FOUND");
  return challenge;
}

function publishedChallenge(store: ChallengeContext["store"], id: string) {
  const challenge = store.getPublished(id);
  if (!challenge) throw new ApiError(404, "Published challenge not found.", "NOT_FOUND");
  return challenge;
}
