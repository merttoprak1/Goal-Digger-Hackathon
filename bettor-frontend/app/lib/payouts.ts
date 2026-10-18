import { z } from "zod";
const amount = z.string().regex(/^[1-9]\d*$/);
const participant = z.object({
  id: z.string(),
  displayName: z.string(),
  createdAt: z.string(),
});
const challenge = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  proofDeadline: z.string(),
  outcome: z.object({ status: z.enum(["success", "failure"]) }).nullable(),
});
const plan = z.object({
  challengeId: z.string(),
  poolAtomic: amount,
  allocations: z.array(z.object({ participantId: z.string(), amountAtomic: amount })),
});
const claim = z.object({
  payoutId: z.string(),
  invoice: z.string(),
  amountAtomic: amount,
  payout: z.object({ status: z.literal("prepared") }).nullable(),
});
const execution = z.discriminatedUnion("status", [
  z.object({ status: z.literal("unknown"), txid: z.null() }),
  z.object({ status: z.literal("accepted"), txid: z.string().regex(/^[a-f0-9]{64}$/) }),
]);
export type Participant = z.infer<typeof participant>;
export type PayoutChallenge = z.infer<typeof challenge>;
export type PayoutPlan = z.infer<typeof plan>;
export type PayoutClaim = z.infer<typeof claim>;
export type PayoutExecution = z.infer<typeof execution>;
export class PayoutError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export function createPayoutClient({
  fetchService = fetch,
  baseUrl = "/api",
}: { fetchService?: typeof fetch; baseUrl?: string } = {}) {
  async function call<T>(
    path: string,
    token: string | undefined,
    schema: z.ZodType<T>,
    body?: unknown,
    allowUnknown = false,
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetchService(baseUrl.replace(/\/$/, "") + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(90000),
      });
    } catch {
      throw new PayoutError(
        503,
        "UNAVAILABLE",
        "The service is unavailable. Refresh the saved payout before trying again.",
      );
    }
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      if (
        allowUnknown &&
        response.status === 409 &&
        z
          .object({ execution: execution.refine((e) => e.status === "unknown") })
          .safeParse(payload).success
      )
        return schema.parse(payload);
      const parsed = z
        .object({ error: z.object({ code: z.string(), message: z.string() }) })
        .safeParse(payload);
      throw new PayoutError(
        response.status,
        parsed.success ? parsed.data.error.code : "REQUEST_FAILED",
        parsed.success
          ? parsed.data.error.message
          : "The request failed. Refresh the saved payout before trying again.",
      );
    }
    const parsed = schema.safeParse(payload);
    if (!parsed.success)
      throw new PayoutError(
        502,
        "INVALID_RESPONSE",
        "The service returned an invalid payout record.",
      );
    return parsed.data;
  }
  const path = (id: string, suffix: string) =>
    `/challenges/${encodeURIComponent(id)}/${suffix}`;
  return {
    createSession: (displayName: string) =>
      call(
        "/sessions",
        undefined,
        z.object({ participant, token: z.string().regex(/^[a-f0-9]{64}$/) }),
        { displayName },
      ),
    me: (token: string) => call("/me", token, z.object({ participant })),
    list: (token: string, offset = 0) =>
      call(
        `/challenges?limit=100&offset=${offset}`,
        token,
        z.object({ challenges: z.array(challenge) }),
      ),
    plan: (id: string, token: string) =>
      call(path(id, "payout-plan"), token, z.object({ plan: plan.nullable() })),
    calculate: (id: string, token: string) =>
      call(path(id, "payout-plan"), token, z.object({ plan }), {}),
    claim: (id: string, token: string) =>
      call(path(id, "payout-request"), token, z.object({ claim: claim.nullable() })),
    prepare: (id: string, token: string, invoice: string) =>
      call(path(id, "payout-request"), token, z.object({ claim }), { invoice }),
    execution: (id: string, token: string) =>
      call(
        path(id, "payout-execution"),
        token,
        z.object({ execution: execution.nullable() }),
      ),
    execute: (id: string, token: string) =>
      call(path(id, "payout-execution"), token, z.object({ execution }), {}, true),
  };
}
export function payoutSession(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
) {
  const key = "goal-digger-participant-token";
  return {
    read() {
      try {
        const token = storage.getItem(key);
        return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
      } catch {
        return null;
      }
    },
    save(token: string) {
      try {
        storage.setItem(key, token);
        return true;
      } catch {
        return false;
      }
    },
    clear() {
      try {
        storage.removeItem(key);
      } catch {
        /* Storage can be disabled. */
      }
    },
  };
}
