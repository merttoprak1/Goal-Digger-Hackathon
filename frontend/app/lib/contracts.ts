import { z } from "zod";

/**
 * Types shared with the API.
 *
 * The shape mirrors what the UI renders today (see the approved designs). When
 * the Express API lands, extra server-owned fields can be added alongside these
 * — nothing here is display-only except the small colour/emoji hints.
 */

/* ------------------------------- challenges ------------------------------ */

export const CHALLENGE_STATUSES = ["active", "draft", "open", "new"] as const;
export type ChallengeStatus = (typeof CHALLENGE_STATUSES)[number];

export const CHALLENGE_TEMPLATES = [
  "run",
  "exam",
  "wake_up",
  "leetcode",
  "custom",
] as const;
export type ChallengeTemplate = (typeof CHALLENGE_TEMPLATES)[number];

/**
 * Footer of a challenge card. Either an actionable counter-stake or a passive
 * status line (used by drafts that cannot be joined yet). The button carries no
 * tone: every card action is the same indigo.
 */
export type ChallengeAction =
  | { kind: "button"; label: string }
  | { kind: "info"; label: string; note: string };

export interface Challenge {
  id: string;
  title: string;
  /** Display name of the creator. */
  creator: string;
  status: ChallengeStatus;
  template: string;
  templateEmoji: string;
  /** Creator's own stake, formatted as a decimal string. */
  stakeUsdt: string;
  /** Confirmed opponent pool, or null while the pool is still empty. */
  poolUsdt: string | null;
  /** What the arbiter will look at, e.g. "Strava GPS sync". */
  proofSource: string;
  action: ChallengeAction;
  proofDeadline: string;
  createdAt: string;
}

/** The Goaly arbiter shown in the right-hand panel. */
export interface ArbiterProfile {
  name: string;
  role: string;
  agent: string;
  statusText: string;
  /** First messages in the conversation feed. */
  greeting: string[];
  /** Canned replies used when a contract is proposed. */
  replyQuotes: string[];
}

export interface ProtocolStatus {
  blockHeight: string;
  rgbStatus: string;
  team: string;
  links: Array<{ label: string; href: string }>;
}

export interface ChallengesSnapshot {
  challenges: Challenge[];
  arbiter: ArbiterProfile;
  protocol: ProtocolStatus;
}

/* --------------------------------- profile -------------------------------- */

/** Accent tones the profile screens use for badges and figures. */
export type AccentTone =
  | "indigo"
  | "violet"
  | "emerald"
  | "blue"
  | "rose"
  | "slate";

export interface ProfileStat {
  id: string;
  label: string;
  value: string;
  unit?: string;
  note: string;
  noteTone: AccentTone;
  icon: string;
  iconTone: AccentTone;
}

export interface StakeBadge {
  label: string;
  tone: "emerald" | "violet" | "blue";
}

/** The single descriptive row in the middle of a stake card. */
export interface StakeNote {
  icon: string;
  text: string;
  trailing?: string;
  /** Cards 2 and 3 draw this row inside a tinted panel. */
  boxed: boolean;
}

export interface StakeAction {
  label: string;
  tone: "ghost" | "primary" | "cyan";
  /** Material Symbols icon name. */
  icon?: string;
}

export interface ProfileStake {
  id: string;
  title: string;
  badge: StakeBadge;
  icon: string;
  iconTone: "blue" | "violet" | "slate";
  meta: string;
  /** Rendered in red after the meta line, e.g. "3 hours left". */
  urgency?: string;
  stakeUsdt: string;
  /** Opponent pool, or null when nobody has joined yet. */
  poolUsdt: string | null;
  note: StakeNote;
  /** Only the "in progress" style cards show a progress bar. */
  progress?: { label: string; percent: number };
  footer: string;
  actions: StakeAction[];
}

/** A fragment of the arbiter's message, so emphasis can be rendered safely. */
export interface QuoteSegment {
  text: string;
  bold?: boolean;
  emphasis?: "emerald" | "violet";
}

export interface ArbiterAuditRow {
  label: string;
  value: string;
  tone: "emerald" | "slate";
}

export interface ProfileArbiter {
  name: string;
  role: string;
  verified: boolean;
  quote: QuoteSegment[];
  rows: ArbiterAuditRow[];
  logLabel: string;
}

export interface WalletBalance {
  network: string;
  usdt: string;
  tbtc: string;
}

export interface UserProfile {
  name: string;
  handle: string;
  walletAddress: string;
  node: string;
  tabs: {
    activeStakes: number;
    settledWon: number;
    createdPools: number;
  };
}

export interface ProfileSnapshot {
  profile: UserProfile;
  stats: ProfileStat[];
  stakes: ProfileStake[];
  arbiter: ProfileArbiter;
  balance: WalletBalance;
}

/* --------------------------------- wallet -------------------------------- */

/** How a wallet entry moved money; drives its icon, sign and colour. */
export type WalletEntryKind = "deposit" | "lock" | "release" | "payout" | "fee";

export interface WalletEntry {
  id: string;
  label: string;
  /** Where it came from, e.g. `DLC #8942-B`. */
  detail: string;
  /** Signed, formatted amount, e.g. `+18.20` or `-2.50`. */
  amount: string;
  unit: "USDT" | "tBTC";
  kind: WalletEntryKind;
  badge: StakeBadge;
  timestamp: string;
}

/** A challenge currently holding part of the balance in escrow. */
export interface EscrowHold {
  /** Matches a challenge id, so the row can link back to it. */
  id: string;
  title: string;
  amountUsdt: string;
  /** The funding outpoint, shown as a footnote. */
  via: string;
}

export interface WalletSnapshot {
  network: string;
  address: string;
  availableUsdt: string;
  lockedUsdt: string;
  tbtc: string;
  /** USD value of the tBTC balance, pre-formatted. */
  tbtcUsd: string;
  stats: ProfileStat[];
  holds: EscrowHold[];
  entries: WalletEntry[];
}

/* --------------------------------- payout -------------------------------- */

/** One pool, either ready to claim or still waiting on the oracle. */
export interface PayoutPool {
  id: string;
  title: string;
  amountUsdt: string;
  /** Which oracle evidence settled it. */
  proof: string;
  /** Short timing line, e.g. `Settled 2 hours ago`. */
  timing: string;
}

export interface PayoutHistoryRow {
  id: string;
  title: string;
  amountUsdt: string;
  result: "won" | "lost";
  at: string;
}

export interface PayoutSnapshot {
  claimableUsdt: string;
  awaitingUsdt: string;
  lifetimeUsdt: string;
  /** Settled pools all time, won or lost. */
  settledCount: number;
  claimable: PayoutPool[];
  pending: PayoutPool[];
  history: PayoutHistoryRow[];
}

/* ------------------------------- responses ------------------------------- */

export interface HealthResponse {
  status: "ok";
  integrations: { rgb: string; qvac: string };
}

export interface ChallengeResponse {
  challenge: Challenge;
}

export interface ChallengeListResponse {
  challenges: Challenge[];
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string[]>;
  };
}

/* ------------------------------- requests -------------------------------- */

const amount = z
  .string()
  .regex(
    /^(?:0|[1-9]\d{0,5})(?:\.\d{1,6})?$/,
    "Use a positive amount with up to 6 decimals.",
  )
  .refine((value) => Number(value) > 0, "Enter an amount greater than zero.");

/** Client-side mirror of the server's validation for the create form. */
export const createChallengeSchema = z
  .object({
    template: z.enum(CHALLENGE_TEMPLATES),
    creator: z.string().trim().min(1).max(60),
    title: z.string().trim().min(3).max(120),
    stakeUsdt: amount,
    proofSource: z.string().trim().min(3).max(160),
    proofDeadline: z.iso.datetime({ offset: true }),
  })
  .strict()
  .superRefine((value, context) => {
    if (Date.parse(value.proofDeadline) <= Date.now()) {
      context.addIssue({
        code: "custom",
        path: ["proofDeadline"],
        message: "The proof deadline must be in the future.",
      });
    }
  });

export type CreateChallengeRequest = z.infer<typeof createChallengeSchema>;
