import { expect, it } from "vitest";
import { localProofReviewer } from "../src/services/local-proof-reviewer.js";

const input = {
  question: "41 + 17",
  evidence: "Submitted answer: 58.",
  expectedAnswer: 58,
};
const customInput = {
  challengeId: "challenge-123",
  proofMethod: "custom" as const,
  successRule: "Publish a completed 5 km run from the event page.",
  evidence: "I completed the 5 km run and attached the event result.",
};

it("sends only server-prepared evidence and verifies the returned local rule", async () => {
  let sent: Record<string, unknown> | null = null;
  const reviewer = localProofReviewer({
    fetchService: async (_url, init) => {
      sent = JSON.parse(String(init?.body));
      return Response.json({
        rule: { id: "challenge-timed-math-v1", question: input.question },
        verdict: "accepted",
        reason: "The submitted answer is correct.",
      });
    },
  });
  expect(await reviewer(input)).toEqual({
    verdict: "accepted",
    reason: "The submitted answer is correct.",
    reviewer: "local-qvac",
  });
  expect(sent).toEqual(input);
});

it("keeps unclear, malformed, mismatched, and unavailable agent results unapproved", async () => {
  const unclear = localProofReviewer({
    fetchService: async () => Response.json({
      rule: { id: "challenge-timed-math-v1", question: input.question },
      verdict: "unclear",
      reason: "Submit one clear answer.",
    }),
  });
  await expect(unclear(input)).resolves.toMatchObject({ verdict: "unclear" });

  const invalid = localProofReviewer({
    fetchService: async () => Response.json({
      rule: { id: "other-rule", question: input.question },
      verdict: "accepted",
      reason: "Wrong rule identifier.",
    }),
  });
  await expect(invalid(input)).rejects.toMatchObject({
    status: 502,
    code: "PROOF_REVIEW_INVALID",
  });

  const unavailable = localProofReviewer({
    fetchService: async () => { throw new TypeError("offline"); },
  });
  await expect(unavailable(input)).rejects.toMatchObject({
    status: 503,
    code: "PROOF_REVIEW_UNAVAILABLE",
  });
});

it("rejects unsupported verdict values instead of authorizing a proof", async () => {
  const reviewer = localProofReviewer({
    fetchService: async () => Response.json({
      rule: { id: "challenge-timed-math-v1", question: input.question },
      verdict: "approve",
      reason: "Unsupported decision.",
    }),
  });
  await expect(reviewer(input)).rejects.toMatchObject({
    status: 502,
    code: "PROOF_REVIEW_INVALID",
  });
});

it("sends custom proof with challenge context and validates the Goaly review", async () => {
  let sent: Record<string, unknown> | null = null;
  let sentUrl = "";
  const reviewer = localProofReviewer({
    reviewUrl: "http://127.0.0.1:4000/qvac/review",
    fetchService: async (url, init) => {
      sentUrl = String(url);
      sent = JSON.parse(String(init?.body));
      return Response.json({
        challengeId: customInput.challengeId,
        rule: { id: "challenge-custom-v1", successRule: customInput.successRule },
        verdict: "accepted",
        reason: "The evidence supports the stated completion.",
      });
    },
  });

  expect(await reviewer(customInput)).toEqual({
    verdict: "accepted",
    reason: "The evidence supports the stated completion.",
    reviewer: "local-qvac",
  });
  expect(sentUrl).toBe("http://127.0.0.1:4000/qvac/review");
  expect(sent).toEqual(customInput);
});

it("keeps unclear or context-mismatched custom review unapproved", async () => {
  const unclear = localProofReviewer({
    fetchService: async () =>
      Response.json({
        challengeId: customInput.challengeId,
        rule: { id: "challenge-custom-v1", successRule: customInput.successRule },
        verdict: "unclear",
        reason: "The evidence is not specific enough.",
      }),
  });
  await expect(unclear(customInput)).resolves.toMatchObject({ verdict: "unclear" });

  const mismatch = localProofReviewer({
    fetchService: async () =>
      Response.json({
        challengeId: "different-challenge",
        rule: { id: "challenge-custom-v1", successRule: customInput.successRule },
        verdict: "accepted",
        reason: "The evidence supports the stated completion.",
      }),
  });
  await expect(mismatch(customInput)).rejects.toMatchObject({
    status: 502,
    code: "PROOF_REVIEW_INVALID",
  });
});
