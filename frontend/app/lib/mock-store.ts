import {
  WAKE_UP_PROOF,
  type Challenge,
  type CreateChallengeRequest,
  type ProofTerms,
} from "./contracts";

/**
 * In-memory mock backend. It lives for the lifetime of the tab, which is enough
 * to design and demo the UI before the Express API exists.
 *
 * Delete this file (and the mock branches in `api.ts`) once the real API lands.
 */

const EXAM_PROOF: ProofTerms = {
  method: "document",
  source: "University transcript or official results page.",
  successRule: "Show the declared passing grade for the named exam.",
  retryRule: "Unclear evidence allows another attempt before the proof deadline.",
  failureRule: "No accepted proof by the deadline means the creator loses.",
};

const RUN_PROOF: ProofTerms = {
  method: "activity_record",
  source: "Activity record from the declared fitness service.",
  successRule: "Reach the declared distance before the deadline.",
  retryRule: "Unclear evidence allows another attempt before the proof deadline.",
  failureRule: "No accepted proof by the deadline means the creator loses.",
};

function seed(): Challenge[] {
  return [
    {
      id: "seed-wake-up",
      template: "wake_up",
      creatorName: "Mert",
      title: "I will wake up at 07:00",
      requestedStakeUsdt: "5",
      timezone: "Europe/Rome",
      bettingClosesAt: "2030-01-02T06:00:00+01:00",
      startsAt: "2030-01-02T07:00:00+01:00",
      proofDeadline: "2030-01-02T07:05:00+01:00",
      status: "open",
      createdAt: "2026-10-16T09:12:00.000Z",
      termsEditable: false,
      proof: WAKE_UP_PROOF,
      funding: {
        status: "confirmed",
        network: "mutinynet",
        confirmedPoolUsdt: "20",
      },
    },
    {
      id: "seed-exam",
      template: "exam",
      creatorName: "Ege",
      title: "Pass the distributed systems exam",
      requestedStakeUsdt: "10",
      timezone: "Europe/Istanbul",
      bettingClosesAt: "2030-02-01T07:00:00+03:00",
      startsAt: "2030-02-10T09:00:00+03:00",
      proofDeadline: "2030-03-01T23:59:00+03:00",
      status: "draft",
      createdAt: "2026-10-16T14:40:00.000Z",
      termsEditable: true,
      proof: EXAM_PROOF,
      funding: {
        status: "not_connected",
        network: "mutinynet",
        confirmedPoolUsdt: null,
      },
    },
    {
      id: "seed-run",
      template: "run",
      creatorName: "Vesim",
      title: "Run 10 km before 09:00",
      requestedStakeUsdt: "2.5",
      timezone: "Europe/Istanbul",
      bettingClosesAt: "2030-03-01T05:00:00+03:00",
      startsAt: "2030-03-01T06:00:00+03:00",
      proofDeadline: "2030-03-01T09:00:00+03:00",
      status: "active",
      createdAt: "2026-10-17T06:05:00.000Z",
      termsEditable: false,
      proof: RUN_PROOF,
      funding: {
        status: "pending",
        network: "mutinynet",
        confirmedPoolUsdt: "7.5",
      },
    },
  ];
}

let challenges: Challenge[] = seed();

function byNewestFirst(a: Challenge, b: Challenge): number {
  return b.createdAt.localeCompare(a.createdAt);
}

export function listChallenges(): Challenge[] {
  return [...challenges].sort(byNewestFirst);
}

export function getChallenge(id: string): Challenge | undefined {
  return challenges.find((challenge) => challenge.id === id);
}

export function insertChallenge(
  request: CreateChallengeRequest,
  now: Date = new Date(),
): Challenge {
  const challenge: Challenge = {
    ...request,
    id: crypto.randomUUID(),
    status: "draft",
    createdAt: now.toISOString(),
    termsEditable: false,
    proof: WAKE_UP_PROOF,
    funding: {
      status: "not_connected",
      network: "mutinynet",
      confirmedPoolUsdt: null,
    },
  };
  challenges = [challenge, ...challenges];
  return challenge;
}

/** Useful while designing: reset the mocks from the browser console. */
export function resetChallenges(): void {
  challenges = seed();
}

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__resetGoalDiggerMocks =
    resetChallenges;
}
