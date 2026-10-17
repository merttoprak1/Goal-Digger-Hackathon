import { Router } from "express";
import type { StakeDeposits } from "../../../vault/stake-deposits.mjs";
import { sessionIdentity } from "./sessions.js";
import type { PayoutVault, SessionStore } from "./challenge/context.js";
import { registerDraftRoutes } from "./challenge/drafts.js";
import { registerFundingRoutes } from "./challenge/funding.js";
import { registerProofRoutes } from "./challenge/proofs.js";
import { registerSettlementRoutes } from "./challenge/settlement.js";

export function challengeRoutes(
  store: SessionStore,
  stakes?: StakeDeposits,
  payoutVault?: PayoutVault,
) {
  const router = Router();
  const context = { store, stakes, payoutVault };

  router.use((req, res, next) => {
    res.locals.participant = sessionIdentity(store, req.header("authorization")).participant;
    next();
  });

  registerFundingRoutes(router, context);
  registerProofRoutes(router, context);
  registerSettlementRoutes(router, context);
  registerDraftRoutes(router, context);
  return router;
}
