import type { AccentTone, StakeAction, StakeBadge } from "./contracts";

/** Shared accent maps so the profile and create screens stay consistent. */

export const ICON_TILE: Record<AccentTone, string> = {
  indigo: "bg-indigo-50 text-indigo-600",
  blue: "bg-blue-50 text-blue-600",
  violet: "bg-violet-50 text-violet-600",
  emerald: "bg-emerald-50 text-emerald-600",
  rose: "bg-rose-50 text-rose-500",
  slate: "bg-slate-100 text-slate-500",
};

export const NOTE_TONE: Record<AccentTone, string> = {
  indigo: "text-indigo-600",
  blue: "text-blue-600",
  violet: "text-violet-600",
  emerald: "text-emerald-600",
  rose: "text-rose-500",
  slate: "text-slate-500",
};

export const BADGE_TONE: Record<StakeBadge["tone"], string> = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
};

export const ACTION_TONE: Record<StakeAction["tone"], string> = {
  ghost:
    "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300",
  primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm",
  cyan: "border border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100",
};
