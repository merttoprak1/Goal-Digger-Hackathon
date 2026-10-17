import "dotenv/config";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4002),
  DATABASE_PATH: z
    .string()
    .min(1)
    .default(fileURLToPath(new URL("../../data/api.sqlite", import.meta.url))),
  VAULT_API_TOKEN: z.string().min(1).optional(),
  QVAC_ASSESS_URL: z.string().url().default("http://127.0.0.1:4000/qvac/assess"),
  QVAC_REVIEW_URL: z.string().url().default("http://127.0.0.1:4000/qvac/review"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // NOTE: when RGB/Bitcoin integration lands, add an explicit network setting here,
  // e.g. BTC_NETWORK: z.enum(["regtest", "signet", "testnet", "mainnet"])
  // and fail closed if it is missing. Never default silently to mainnet.
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment:", z.treeifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
