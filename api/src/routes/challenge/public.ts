import type { Router } from "express";
import { z } from "zod";
import { ApiError } from "../../middlewares/error-handler.js";
import type { ChallengeContext } from "./context.js";
import { prizeShares } from "./prize.js";
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

export function registerPublicRoutes(router: Router, { store }: ChallengeContext): void {
  router.get("/", (req, res, next) => {
    if (req.header("authorization")) return next();
    const parsed = pageQuery.safeParse(req.query);
    if (!parsed.success) {
      throw new ApiError(
        400,
        "Use a limit of 1 to 100 and a nonnegative offset.",
        "INVALID_PAGINATION",
      );
    }
    const challenges = store
      .listPublished(parsed.data.limit, parsed.data.offset)
      .map((challenge) => projectChallenge(store, challenge));
    res.json({ challenges });
  });

  router.get("/:id/prize-shares", (req, res) => {
    const challenge = store.getPublished(String(req.params.id));
    if (!challenge) throw new ApiError(404, "Challenge not found.", "NOT_FOUND");
    res.json(prizeShares(store, challenge));
  });

  router.get("/:id", (req, res, next) => {
    if (req.header("authorization")) return next();
    const challenge = store.getPublished(String(req.params.id));
    if (!challenge) throw new ApiError(404, "Challenge not found.", "NOT_FOUND");
    res.json({ challenge: projectChallenge(store, challenge) });
  });
}
