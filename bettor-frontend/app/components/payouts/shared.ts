import { createPayoutClient, type Participant } from "~/lib/payouts";

export const client = createPayoutClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? "/api",
});
export const button =
  "rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50";
export const input =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 focus:outline-2 focus:outline-indigo-500";
export const message = (error: unknown) =>
  error instanceof Error ? error.message : "The request failed.";
export interface Session {
  token: string;
  participant: Participant;
}
