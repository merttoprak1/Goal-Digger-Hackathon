import { z } from 'zod';

export const createChallengeSchema = z.object({
  template: z.literal('wake_up'),
  creatorName: z.string().trim().min(1).max(80),
  title: z.string().trim().min(3).max(120),
  requestedStakeUsdt: z.string().regex(/^(?:0|[1-9]\d{0,5})(?:\.\d{1,6})?$/)
    .refine((value) => Number(value) > 0, 'Enter an amount greater than zero.'),
  timezone: z.string().max(80).refine((value) => {
    try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; }
    catch { return false; }
  }, 'Enter a valid IANA timezone.'),
  bettingClosesAt: z.iso.datetime({ offset: true }),
  startsAt: z.iso.datetime({ offset: true }),
  proofDeadline: z.iso.datetime({ offset: true }),
}).strict().superRefine((value, context) => {
  if (Date.parse(value.bettingClosesAt) > Date.parse(value.startsAt)) {
    context.addIssue({ code: 'custom', path: ['bettingClosesAt'], message: 'Betting must close before the challenge starts.' });
  }
  if (Date.parse(value.proofDeadline) <= Date.parse(value.startsAt)) {
    context.addIssue({ code: 'custom', path: ['proofDeadline'], message: 'The proof deadline must follow the start time.' });
  }
});

export type CreateChallengeRequest = z.infer<typeof createChallengeSchema>;

export const WAKE_UP_PROOF = Object.freeze({
  method: 'timed_math' as const,
  source: 'A fresh problem and server-recorded answer and submission time.',
  successRule: 'Submit the correct answer during the proof window.',
  retryRule: 'Unclear evidence allows another attempt before the proof deadline.',
  failureRule: 'No accepted proof by the deadline means the creator loses.',
});

export interface Challenge extends CreateChallengeRequest {
  id: string;
  status: 'draft';
  createdAt: string;
  termsEditable: false;
  proof: typeof WAKE_UP_PROOF;
  funding: { status: 'not_connected'; network: 'mutinynet'; confirmedPoolUsdt: null };
}

export interface ApiError {
  error: { code: string; message: string; fields?: Record<string, string[]> };
}

export interface HealthResponse {
  status: 'ok';
  integrations: { rgb: 'not_connected'; qvac: 'not_connected' };
}

export interface ChallengeResponse { challenge: Challenge }
export interface ChallengeListResponse { challenges: Challenge[] }
