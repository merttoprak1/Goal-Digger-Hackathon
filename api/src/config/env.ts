import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().int().default(3000),
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
