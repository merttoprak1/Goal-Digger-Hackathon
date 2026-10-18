import { vaultPayouts } from "./services/vault-payouts.js";
import express from "express";
import { openStakeDeposits, type StakeDeposits } from "../../vault/stake-deposits.mjs";
import { openSessions } from "./store/sessions.js";
import { challengeRoutes } from "./routes/challenges.js";
import { sessionRoutes } from "./routes/sessions.js";
import morgan from "morgan";
import { env } from "./config/env.js";
import { ApiError, errorHandler } from "./middlewares/error-handler.js";
import { requestId } from "./middlewares/request-id.js";
import { createRoutes } from "./routes/index.js";
import { localProofReviewer } from "./services/local-proof-reviewer.js";

export function createApp({
  databasePath = env.DATABASE_PATH,
  stakeDeposits,
  payoutVault,
  proofReviewer,
  readinessFetch = fetch,
}: {
  databasePath?: string;
  stakeDeposits?: StakeDeposits;
  payoutVault?: ReturnType<typeof vaultPayouts>;
  proofReviewer?: ReturnType<typeof localProofReviewer>;
  readinessFetch?: typeof fetch;
} = {}) {
  const app = express();

  const sessionStore = openSessions(databasePath);
  app.locals.sessionStore = sessionStore;
  const stakes =
    stakeDeposits ??
    (env.VAULT_API_TOKEN
      ? openStakeDeposits({ databasePath, token: env.VAULT_API_TOKEN })
      : undefined);
  app.locals.stakeDeposits = stakes;
  app.locals.close = () => {
    if (!stakeDeposits) stakes?.close();
    sessionStore.close();
  };
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use(
    "/api/challenges/:id/proof-note",
    express.json({ limit: "16kb" }),
  );
  app.use(express.json({ limit: "4kb" }));
  app.use(requestId);
  if (env.NODE_ENV !== "test") {
    app.use(morgan("dev"));
  }

  app.use("/api", sessionRoutes(sessionStore));
  app.use(
    "/api/challenges",
    challengeRoutes(
      sessionStore,
      stakes,
      payoutVault ??
        (env.VAULT_API_TOKEN ? vaultPayouts(env.VAULT_API_TOKEN) : undefined),
      proofReviewer ??
        localProofReviewer({ url: env.QVAC_ASSESS_URL, reviewUrl: env.QVAC_REVIEW_URL }),
    ),
  );
  const healthRoutes = createRoutes({
    database: () => sessionStore.checkReady(),
    vault: () => stakes?.health() ?? false,
    qvacRgb: async () => {
      const url = new URL("/health", env.QVAC_REVIEW_URL);
      const response = await readinessFetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(3000),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!body || typeof body !== "object") return { qvac: false, rgb: false };
      const result = body as {
        qvac?: { status?: unknown };
        rgb?: { status?: unknown };
      };
      return {
        qvac: result.qvac?.status === "ok",
        rgb: result.rgb?.status === "ok",
      };
    },
  });
  app.use("/api", healthRoutes);
  app.use(healthRoutes);
  app.use((_req, _res, next) =>
    next(new ApiError(404, "Endpoint not found.", "NOT_FOUND")),
  );

  app.use(errorHandler);
  return app;
}
