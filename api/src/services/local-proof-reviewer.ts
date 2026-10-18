import { z } from "zod";
import { ApiError } from "../middlewares/error-handler.js";

export interface MathProofReviewInput {
  question: string;
  evidence: string;
  expectedAnswer: number;
}

export interface CustomProofReviewInput {
  challengeId: string;
  proofMethod: "custom";
  successRule: string;
  evidence: string;
  image?: { mimeType: "image/jpeg" | "image/png" | "image/webp"; dataUrl: string };
}

export type ProofReviewInput = MathProofReviewInput | CustomProofReviewInput;

export interface ProofReview {
  verdict: "accepted" | "rejected" | "unclear";
  reason: string;
  reviewer: "local-qvac";
}

const responseSchema = z.object({
  rule: z.object({ id: z.string(), question: z.string() }),
  verdict: z.enum(["accepted", "rejected", "unclear"]),
  reason: z.string().min(1).max(300),
});

const customResponseSchema = z.object({
  challengeId: z.string(),
  rule: z.object({ id: z.string(), successRule: z.string() }).strict(),
  verdict: z.enum(["accepted", "rejected", "unclear"]),
  reason: z.string().min(1).max(300),
}).strict();

export function localProofReviewer({
  fetchService = fetch,
  url = "http://127.0.0.1:4000/qvac/assess",
  reviewUrl = "http://127.0.0.1:4000/qvac/review",
}: {
  fetchService?: typeof fetch;
  url?: string;
  reviewUrl?: string;
} = {}) {
  return async (input: ProofReviewInput): Promise<ProofReview> => {
    const custom = "proofMethod" in input;
    const outgoingPayload = "proofMethod" in input && input.image
      ? { ...input, imageDataUrl: input.image.dataUrl, image: undefined }
      : input;
    let response: Response;
    try {
      response = await fetchService(custom ? reviewUrl : url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(outgoingPayload),
        signal: AbortSignal.timeout(custom && input.image ? 60_000 : 35_000),
      });
    } catch (cause) {
      const timeout = cause instanceof Error && cause.name === "TimeoutError";
      throw new ApiError(
        timeout ? 504 : 503,
        timeout
          ? "The local proof reviewer timed out. The answer was not recorded."
          : "The local proof reviewer is unavailable. Start QVAC, then try this proof again.",
        "PROOF_REVIEW_UNAVAILABLE",
      );
    }

    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message = z.object({ error: z.string() }).safeParse(payload);
      throw new ApiError(
        response.status >= 500 ? response.status : 502,
        message.success
          ? `The local proof reviewer could not assess this answer: ${message.data.error}`
          : "The local proof reviewer returned an error. The proof was not recorded.",
        "PROOF_REVIEW_UNAVAILABLE",
      );
    }

    if ("proofMethod" in input) {
      const parsed = customResponseSchema.safeParse(payload);
      if (
        !parsed.success ||
        parsed.data.challengeId !== input.challengeId ||
        parsed.data.rule.id !== "challenge-custom-v1" ||
        parsed.data.rule.successRule !== input.successRule
      ) {
        throw invalidAssessment();
      }
      return { verdict: parsed.data.verdict, reason: parsed.data.reason, reviewer: "local-qvac" };
    }
    const parsed = responseSchema.safeParse(payload);
    if (
      !parsed.success ||
      parsed.data.rule.id !== "challenge-timed-math-v1" ||
      parsed.data.rule.question !== input.question
    ) {
      throw invalidAssessment();
    }
    return { verdict: parsed.data.verdict, reason: parsed.data.reason, reviewer: "local-qvac" };
  };
}

function invalidAssessment() {
  return new ApiError(
    502,
    "The local proof reviewer returned an invalid assessment. The proof was not recorded.",
    "PROOF_REVIEW_INVALID",
  );
}
