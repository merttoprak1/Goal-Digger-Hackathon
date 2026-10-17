import { z } from "zod";

/**
 * Types shared with the API. These intentionally mirror the shape the backend
 * team agreed on so switching from mocks to the real server needs no UI changes.
 */

export const CHALLENGE_TEMPLATES = ["wake_up", "exam", "run", "custom"] as const;
export type ChallengeTemplate = (typeof CHALLENGE_TEMPLATES)[number];

export type ChallengeStatus =
  | "draft"
  | "open"
  | "active"
  | "settled"
  | "failed";

export type FundingStatus = "not_connected" | "pending" | "confirmed";

export interface ProofTerms {
  method: string;
  source: string;
  successRule: string;
  retryRule: string;
  failureRule: string;
}

export interface Funding {
  status: FundingStatus;
  network: "mutinynet";
  confirmedPoolUsdt: string | null;
}

export interface Challenge {
  id: string;
  template: ChallengeTemplate;
  creatorName: string;
  title: string;
  requestedStakeUsdt: string;
  timezone: string;
  bettingClosesAt: string;
  startsAt: string;
  proofDeadline: string;
  status: ChallengeStatus;
  createdAt: string;
  /** Becomes `false` for good once the first opponent bets. */
  termsEditable: boolean;
  proof: ProofTerms;
  funding: Funding;
}

export const WAKE_UP_PROOF: ProofTerms = {
  method: "timed_math",
  source: "A fresh problem and server-recorded answer and submission time.",
  successRule: "Submit the correct answer during the proof window.",
  retryRule: "Unclear evidence allows another attempt before the proof deadline.",
  failureRule: "No accepted proof by the deadline means the creator loses.",
};

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

const isoDateTime = z.iso.datetime({ offset: true });

/** Client-side mirror of the server's validation for the create form. */
export const createChallengeSchema = z
  .object({
    template: z.literal("wake_up"),
    creatorName: z.string().trim().min(1).max(80),
    title: z.string().trim().min(3).max(120),
    requestedStakeUsdt: z
      .string()
      .regex(
        /^(?:0|[1-9]\d{0,5})(?:\.\d{1,6})?$/,
        "Use a positive amount with up to 6 decimals.",
      )
      .refine((value) => Number(value) > 0, "Enter an amount greater than zero."),
    timezone: z.string().max(80).refine((value) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, "Enter a valid IANA timezone."),
    bettingClosesAt: isoDateTime,
    startsAt: isoDateTime,
    proofDeadline: isoDateTime,
  })
  .strict()
  .superRefine((value, context) => {
    if (Date.parse(value.bettingClosesAt) > Date.parse(value.startsAt)) {
      context.addIssue({
        code: "custom",
        path: ["bettingClosesAt"],
        message: "Betting must close before the challenge starts.",
      });
    }
    if (Date.parse(value.proofDeadline) <= Date.parse(value.startsAt)) {
      context.addIssue({
        code: "custom",
        path: ["proofDeadline"],
        message: "The proof deadline must follow the start time.",
      });
    }
  });

export type CreateChallengeRequest = z.infer<typeof createChallengeSchema>;
