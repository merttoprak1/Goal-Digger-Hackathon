import type { Router } from "express";
import { z } from "zod";
import { challengeDraftSchema } from "../../contracts/challenge.js";
import { ApiError } from "../../middlewares/error-handler.js";
import {
  participantId,
  type ChallengeContext,
} from "./context.js";
import { projectChallenge } from "./projection.js";

const pageQuery = z
  .object({
    limit: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .pipe(z.number().int().min(1).max(100))
      .default(50),
    offset: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .pipe(z.number().int().min(0).max(1_000_000))
      .default(0),
  })
  .strict();

export function registerDraftRoutes(router: Router, { store }: ChallengeContext): void {
  router.post("/", (req, res) => {
    const parsed = challengeDraftSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(
        400,
        "Check the challenge terms, atomic stake, timezone, and ordered future deadlines.",
        "INVALID_CHALLENGE",
      );
    }
    const challenge = store.createChallenge(participantId(res), parsed.data);
    res.status(201).json({ challenge: projectChallenge(store, challenge) });
  });

  router.get("/", (req, res) => {
    const parsed = pageQuery.safeParse(req.query);
    if (!parsed.success) {
      throw new ApiError(
        400,
        "Use a limit of 1 to 100 and a nonnegative offset.",
        "INVALID_PAGINATION",
      );
    }
    const challenges = store
      .listChallenges(participantId(res), parsed.data.limit, parsed.data.offset)
      .map((challenge) => projectChallenge(store, challenge));
    res.json({ challenges });
  });

  router.get("/:id", (req, res) => {
    const id = String(req.params.id);
    const challenge = store.getChallenge(participantId(res), id) ?? store.getPublished(id);
    if (!challenge) throw new ApiError(404, "Challenge not found.", "NOT_FOUND");
    res.json({ challenge: projectChallenge(store, challenge) });
  });
}
