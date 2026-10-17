import {
  createChallengeSchema,
  type ApiErrorBody,
  type Challenge,
  type ChallengeListResponse,
  type ChallengesSnapshot,
  type CreateChallengeRequest,
  type HealthResponse,
  type PayoutSnapshot,
  type ProfileSnapshot,
  type WalletSnapshot,
} from "./contracts";
import * as mocks from "./mock-store";

/** Flip to real HTTP requests by setting `VITE_USE_MOCKS=false`. */
export const MOCKS_ENABLED = import.meta.env.VITE_USE_MOCKS !== "false";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(
  /\/+$/,
  "",
);

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Record<string, string[]>;

  constructor(
    status: number,
    code: string,
    message: string,
    fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const body = payload as ApiErrorBody | null;
    throw new ApiError(
      response.status,
      body?.error?.code ?? "REQUEST_FAILED",
      body?.error?.message ?? "The request failed. Try again.",
      body?.error?.fields,
    );
  }

  return payload as T;
}

function delay(ms = 250): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* --------------------------------- reads --------------------------------- */

export async function fetchHealth(): Promise<HealthResponse> {
  if (MOCKS_ENABLED) {
    await delay(150);
    return {
      status: "ok",
      integrations: { rgb: "not_connected", qvac: "not_connected" },
    };
  }
  return request<HealthResponse>("/health");
}

/** Everything the Challenges screen needs in one round trip. */
export async function fetchChallengesSnapshot(): Promise<ChallengesSnapshot> {
  if (MOCKS_ENABLED) {
    await delay();
    return mocks.getChallengesSnapshot();
  }
  return request<ChallengesSnapshot>("/challenges/snapshot");
}

export async function fetchChallenges(): Promise<Challenge[]> {
  if (MOCKS_ENABLED) {
    await delay();
    return mocks.listChallenges();
  }
  const { challenges } = await request<ChallengeListResponse>("/challenges");
  return challenges;
}

/** Everything the Profile screen needs in one round trip. */
export async function fetchProfileSnapshot(): Promise<ProfileSnapshot> {
  if (MOCKS_ENABLED) {
    await delay();
    return mocks.getProfileSnapshot();
  }
  return request<ProfileSnapshot>("/profile/snapshot");
}

/** Everything the Wallet screen needs in one round trip. */
export async function fetchWalletSnapshot(): Promise<WalletSnapshot> {
  if (MOCKS_ENABLED) {
    await delay();
    return mocks.getWalletSnapshot();
  }
  return request<WalletSnapshot>("/wallet/snapshot");
}

/** Everything the Payout screen needs in one round trip. */
export async function fetchPayoutSnapshot(): Promise<PayoutSnapshot> {
  if (MOCKS_ENABLED) {
    await delay();
    return mocks.getPayoutSnapshot();
  }
  return request<PayoutSnapshot>("/payout/snapshot");
}

export async function fetchChallenge(id: string): Promise<Challenge | null> {
  if (MOCKS_ENABLED) {
    await delay();
    return mocks.getChallenge(id) ?? null;
  }
  try {
    const { challenge } = await request<{ challenge: Challenge }>(
      `/challenges/${encodeURIComponent(id)}`,
    );
    return challenge;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/* --------------------------------- writes -------------------------------- */

export async function createChallenge(
  input: CreateChallengeRequest,
): Promise<Challenge> {
  if (MOCKS_ENABLED) {
    await delay(400);

    const parsed = createChallengeSchema.safeParse(input);
    if (!parsed.success) {
      const fields: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".") || "form";
        (fields[key] ??= []).push(issue.message);
      }
      throw new ApiError(
        400,
        "INVALID_CHALLENGE",
        "Check the challenge details.",
        fields,
      );
    }

    return mocks.insertChallenge(parsed.data);
  }

  const { challenge } = await request<{ challenge: Challenge }>("/challenges", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return challenge;
}

/** Claim one settled pool and get the refreshed payout snapshot back. */
export async function claimPayout(id: string): Promise<PayoutSnapshot> {
  if (MOCKS_ENABLED) {
    await delay(150);

    const snapshot = mocks.claimPayout(id);
    if (!snapshot) {
      throw new ApiError(
        404,
        "PAYOUT_NOT_FOUND",
        "That payout is no longer claimable.",
      );
    }
    return snapshot;
  }

  return request<PayoutSnapshot>(`/payout/${encodeURIComponent(id)}/claim`, {
    method: "POST",
  });
}
