import type { Challenge, ChallengeStatus } from "./contracts";

/** Presentation maps shared by the challenge list and the detail view. */

export const STATUS_BADGE: Record<ChallengeStatus, string> = {
  active: "bg-blue-50 text-blue-700 border-blue-200",
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  open: "bg-indigo-50 text-indigo-700 border-indigo-200",
  new: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

export const POOL_TONE: Record<ChallengeStatus, string> = {
  active: "text-indigo-600",
  draft: "text-slate-400",
  open: "text-indigo-600",
  new: "text-indigo-600",
};

/** "Proof: Strava GPS sync" → "Strava GPS sync", for use inside a sentence. */
export function proofHint(challenge: Challenge): string {
  return challenge.proofSource.replace(/^Proof:\s*/i, "");
}
