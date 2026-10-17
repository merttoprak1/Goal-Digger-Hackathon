import { z } from "zod";

/**
 * Types shared with the API.
 *
 * The shape mirrors what the UI renders today (see the approved design). When the
 * Express API lands, extra server-owned fields can be added alongside these —
 * nothing here is display-only except `templateEmoji`.
 */

export const CHALLENGE_STATUSES = ["active", "draft", "open", "new"] as const;
export type ChallengeStatus = (typeof CHALLENGE_STATUSES)[number];

export const CHALLENGE_TEMPLATES = ["run", "exam", "wake_up", "leetcode", "custom"] as const;
export type ChallengeTemplate = (typeof CHALLENGE_TEMPLATES)[number];

/** Colour family a card uses for pool figures, buttons and hover states. */
export type ChallengeTone = "indigo" | "violet";

/**
 * Footer of a challenge card. Either an actionable counter-stake or a passive
 * status line (used by drafts that cannot be joined yet).
 */
export type ChallengeAction =
  | { kind: "button"; label: string; tone: ChallengeTone }
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
  level: string;
  accuracy: string;
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
