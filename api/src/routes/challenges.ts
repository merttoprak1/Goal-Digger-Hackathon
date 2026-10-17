import { Router } from "express";
import type { StakeDeposits } from "../../../vault/stake-deposits.mjs";
import { sessionIdentity } from "./sessions.js";
import type { PayoutVault, SessionStore } from "./challenge/context.js";
import { registerDraftRoutes } from "./challenge/drafts.js";
import { registerFundingRoutes } from "./challenge/funding.js";
import { registerLedgerRoutes } from "./challenge/ledger.js";
import type { ProofReviewer } from "./challenge/context.js";
import { registerProofRoutes } from "./challenge/proofs.js";
import { registerPublicRoutes } from "./challenge/public.js";
import { registerSettlementRoutes } from "./challenge/settlement.js";
import { localProofReviewer } from "../services/local-proof-reviewer.js";

export function challengeRoutes(
  store: SessionStore,
  stakes?: StakeDeposits,
  payoutVault?: PayoutVault,
  proofReviewer: ProofReviewer = localProofReviewer(),
) {
  const router = Router();
  const context = {
    store,
    stakes,
    payoutVault,
    proofReviewer,
  };

  registerPublicRoutes(router, context);
  router.use((req, res, next) => {
    res.locals.participant = sessionIdentity(store, req.header("authorization")).participant;
    next();
  });

  registerLedgerRoutes(router, context);
  registerFundingRoutes(router, context);
  registerProofRoutes(router, context);
  registerSettlementRoutes(router, context);
  registerDraftRoutes(router, context);
  return router;
}
