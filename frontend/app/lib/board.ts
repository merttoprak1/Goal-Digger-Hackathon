import { z } from "zod";
import { formatAtomic } from "./wallet.ts";
import { payoutSession } from "./payouts.ts";

const amount = z.string().regex(/^\d+$/);
const recordSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  template: z.string(),
  creatorId: z.string(),
  creatorDisplayName: z.string().min(1),
  status: z.string(),
  proofSource: z.string(),
  proofDeadline: z.string(),
  startsAt: z.string(),
  bettingCutoff: z.string(),
  successRule: z.string(),
  visibility: z.enum(["public", "solo"]).optional(),
  forfeit: z.enum(["donate", "burn", "rollover"]).optional(),
  charity: z.string().optional(),
  creatorStakeAtomic: amount,
  confirmedPoolAtomic: amount,
  eligiblePoolAtomic: amount,
});
type LiveRecord = z.infer<typeof recordSchema>;

export interface BoardChallenge {
  id: string;
  title: string;
  creator: string;
  creatorId: string;
  status: string;
  statusLabel: string;
  template: string;
  templateEmoji: string;
  stakeUsdt: string;
  poolUsdt: string | null;
  confirmedPoolUsdt: string;
  proofSource: string;
  proofDeadline: string;
  startsAt: string;
  bettingCutoff: string;
  successRule: string;
  visibility: "public" | "solo" | null;
  forfeit: "donate" | "burn" | "rollover" | null;
  charity: string | null;
  note: string;
  badge: string;
  hover: string;
  titleHover: string;
  poolTone: string;
}

const STATUS: Record<
  string,
  {
    label: string;
    note: string;
    badge: string;
    hover: string;
    titleHover: string;
    poolTone: string;
  }
> = {
  draft: {
    label: "Draft",
    note: "Awaiting the creator stake",
    badge: "bg-slate-100 text-slate-700 border-slate-200",
    hover: "hover:border-slate-300",
    titleHover: "group-hover:text-indigo-600",
    poolTone: "text-slate-400",
  },
  funded: {
    label: "Funded",
    note: "Creator stake is confirmed. Not published yet",
    badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
    hover: "hover:border-indigo-400",
    titleHover: "group-hover:text-indigo-600",
    poolTone: "text-indigo-600",
  },
  funding_review: {
    label: "Review",
    note: "A late credit needs review",
    badge: "bg-amber-50 text-amber-800 border-amber-200",
    hover: "hover:border-amber-300",
    titleHover: "group-hover:text-amber-700",
    poolTone: "text-amber-700",
  },
  open: {
    label: "Open",
    note: "Betting is open",
    badge: "bg-violet-50 text-violet-700 border-violet-200",
    hover: "hover:border-violet-300",
    titleHover: "group-hover:text-violet-600",
    poolTone: "text-violet-600",
  },
  betting_closed: {
    label: "Closed",
    note: "Betting is closed",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    hover: "hover:border-indigo-400",
    titleHover: "group-hover:text-indigo-600",
    poolTone: "text-indigo-600",
  },
  succeeded: {
    label: "Succeeded",
    note: "The creator proved the goal",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    hover: "hover:border-emerald-300",
    titleHover: "group-hover:text-emerald-700",
    poolTone: "text-emerald-700",
  },
  failed: {
    label: "Failed",
    note: "The creator did not prove the goal",
    badge: "bg-rose-50 text-rose-700 border-rose-200",
    hover: "hover:border-rose-300",
    titleHover: "group-hover:text-rose-700",
    poolTone: "text-rose-700",
  },
};
const FALLBACK = {
  label: "Unknown",
  note: "The challenge status is not recognized",
  badge: "bg-slate-100 text-slate-700 border-slate-200",
  hover: "hover:border-slate-300",
  titleHover: "group-hover:text-slate-700",
  poolTone: "text-slate-500",
};
const EMOJI: Record<string, string> = {
  wake_up: "⏰",
  exam: "🎓",
  run: "🏃",
  custom: "✨",
};

export class BoardError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function toBoardChallenge(record: LiveRecord): BoardChallenge {
  const view = STATUS[record.status] ?? { ...FALLBACK, label: record.status };
  const eligible = BigInt(record.eligiblePoolAtomic);
  return {
    id: record.id,
    title: record.title,
    creator: record.creatorDisplayName,
    creatorId: record.creatorId,
    status: record.status,
    statusLabel: view.label,
    template: record.template.replaceAll("_", " "),
    templateEmoji: EMOJI[record.template] ?? "•",
    stakeUsdt: formatAtomic(record.creatorStakeAtomic, 6),
    poolUsdt: eligible === 0n ? null : formatAtomic(record.eligiblePoolAtomic, 6),
    confirmedPoolUsdt: formatAtomic(record.confirmedPoolAtomic, 6),
    proofSource: record.proofSource,
    proofDeadline: record.proofDeadline,
    startsAt: record.startsAt,
    bettingCutoff: record.bettingCutoff,
    successRule: record.successRule,
    visibility: record.visibility ?? null,
    forfeit: record.forfeit ?? null,
    charity: record.charity ?? null,
    note: view.note,
    badge: view.badge,
    hover: view.hover,
    titleHover: view.titleHover,
    poolTone: view.poolTone,
  };
}

export function customDraft(input: {
  title: string;
  successRule: string;
  stake: string;
  proofDeadline: string;
  proofSource: string;
  visibility: "public" | "solo";
  forfeit: "donate" | "burn" | "rollover";
  charity?: string;
  now?: number;
  timeZone?: string;
}) {
  const title = input.title.trim();
  const successRule = input.successRule.trim().slice(0, 1000);
  const proofSource = input.proofSource.trim();
  if (title.length < 3 || title.length > 120)
    throw new BoardError(
      400,
      "INVALID_CHALLENGE",
      "Enter a title with 3 to 120 characters.",
    );
  if (successRule.length < 3)
    throw new BoardError(
      400,
      "INVALID_CHALLENGE",
      "Describe the success rule in at least 3 characters.",
    );
  if (proofSource.length < 3 || proofSource.length > 500)
    throw new BoardError(
      400,
      "INVALID_CHALLENGE",
      "Enter a proof source with 3 to 500 characters.",
    );
  const stake = usdtToAtomic(input.stake);
  if (!stake)
    throw new BoardError(
      400,
      "INVALID_CHALLENGE",
      "Enter a stake from 0.000001 to 100 test USDT, with at most 6 decimals.",
    );
  const now = input.now ?? Date.now();
  const proofDeadline = Date.parse(input.proofDeadline);
  if (!Number.isFinite(proofDeadline) || proofDeadline < now + 7_200_000)
    throw new BoardError(
      400,
      "INVALID_CHALLENGE",
      "Choose a proof deadline at least 2 hours ahead.",
    );
  const startsAt = proofDeadline - 3_600_000;
  const bettingCutoff = startsAt - 60_000;
  let timeZone = input.timeZone ?? "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone });
  } catch {
    timeZone = "UTC";
  }
  return {
    template: "custom" as const,
    title,
    successRule,
    proofMethod: "custom" as const,
    proofSource,
    timezone: timeZone,
    bettingCutoff: new Date(bettingCutoff).toISOString(),
    startsAt: new Date(startsAt).toISOString(),
    proofDeadline: new Date(proofDeadline).toISOString(),
    creatorStakeAtomic: stake,
    visibility: input.visibility,
    forfeit: input.forfeit,
    ...(input.forfeit === "donate" && input.charity?.trim()
      ? { charity: input.charity.trim() }
      : {}),
  };
}

function usdtToAtomic(value: string): string | null {
  const match = /^(?:0|[1-9]\d{0,2})(?:\.(\d{1,6}))?$/.exec(value.trim());
  if (!match) return null;
  const [whole, fraction = ""] = value.trim().split(".");
  const atomic = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
  if (atomic < 1n || atomic > 100_000_000n) return null;
  return atomic.toString();
}

export function createBoardClient({
  fetchService = fetch,
  baseUrl = "/api",
}: { fetchService?: typeof fetch; baseUrl?: string } = {}) {
  async function call<T>(
    path: string,
    token: string | undefined,
    schema: z.ZodType<T>,
    body?: unknown,
    timeoutMs = 30_000,
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
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new BoardError(
        503,
        "UNAVAILABLE",
        "The challenge service is unavailable. Try again.",
      );
    }
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const parsed = z
        .object({ error: z.object({ code: z.string(), message: z.string() }) })
        .safeParse(payload);
      throw new BoardError(
        response.status,
        parsed.success ? parsed.data.error.code : "REQUEST_FAILED",
        parsed.success ? parsed.data.error.message : `The challenge service returned HTTP ${response.status}. Check payment before retrying.`,
      );
    }
    const parsed = schema.safeParse(payload);
    if (!parsed.success)
      throw new BoardError(
        502,
        "INVALID_RESPONSE",
        "The service returned an invalid challenge record.",
      );
    return parsed.data;
  }
  return {
    createSession: (displayName: string) =>
      call(
        "/sessions",
        undefined,
        z.object({
          participant: z.object({
            id: z.string(),
            displayName: z.string(),
            createdAt: z.string(),
          }),
          token: z.string().regex(/^[a-f0-9]{64}$/),
        }),
        { displayName },
      ),
    me: (token: string) =>
      call(
        "/me",
        token,
        z.object({
          participant: z.object({
            id: z.string(),
            displayName: z.string(),
            createdAt: z.string(),
          }),
        }),
      ),
    list: (token: string) =>
      call(
        "/challenges?limit=100&offset=0",
        token,
        z.object({ challenges: z.array(recordSchema) }),
      ).then((result) => result.challenges.map(toBoardChallenge)),
    listPublic: () =>
      call(
        "/challenges?limit=100&offset=0",
        undefined,
        z.object({ challenges: z.array(recordSchema) }),
      ).then((result) => result.challenges.map(toBoardChallenge)),
    getPublic: (id: string) =>
      call(
        `/challenges/${encodeURIComponent(id)}`,
        undefined,
        z.object({ challenge: recordSchema }),
      ).then((result) => toBoardChallenge(result.challenge)),
    get: (token: string, id: string) =>
      call(
        `/challenges/${encodeURIComponent(id)}`,
        token,
        z.object({ challenge: recordSchema }),
      ).then((result) => toBoardChallenge(result.challenge)),
    createCustom: (token: string, input: Parameters<typeof customDraft>[0]) =>
      call(
        "/challenges",
        token,
        z.object({ challenge: recordSchema }),
        customDraft(input),
      ).then((result) => toBoardChallenge(result.challenge)),
    publish: (token: string, id: string) =>
      call(
        `/challenges/${encodeURIComponent(id)}/publish`,
        token,
        z.object({ challenge: recordSchema }),
        {},
      ).then((result) => toBoardChallenge(result.challenge)),
    createStakeInvoice: (token: string, id: string) =>
      call(
        `/challenges/${encodeURIComponent(id)}/creator-deposit`,
        token,
        z.object({
          invoice: z.string().min(1),
          status: z.string(),
          fresh: z.boolean().optional(),
        }),
        {},
        70_000,
      ),
    checkStake: (token: string, id: string) =>
      call(
        `/challenges/${encodeURIComponent(id)}/creator-deposit`,
        token,
        z.object({ status: z.string() }),
        undefined,
        70_000,
      ),
    placeBet: (token: string, id: string, stakeUsdt: string) => {
      const amountAtomic = usdtToAtomic(stakeUsdt);
      if (!amountAtomic) {
        throw new BoardError(
          400,
          "INVALID_STAKE",
          "Enter a stake from 0.000001 to 100 test USDT, with at most 6 decimals.",
        );
      }
      return call(
        `/challenges/${encodeURIComponent(id)}/opponent-deposit`,
        token,
        z.object({
          invoice: z.string().min(1),
          status: z.string(),
          fresh: z.boolean().optional(),
        }),
        { amountAtomic },
        70_000,
      );
    },
    checkBet: (token: string, id: string) =>
      call(
        `/challenges/${encodeURIComponent(id)}/opponent-deposit`,
        token,
        z.object({ status: z.string() }),
        undefined,
        70_000,
      ),
    prizeShares: (id: string) =>
      call(
        `/challenges/${encodeURIComponent(id)}/prize-shares`,
        undefined,
        z.object({
          poolAtomic: z.string(),
          proofDeadline: z.string(),
          rule: z.string(),
          success: z.array(shareRow),
          failure: z.array(shareRow),
        }),
      ),
    saveProof: (token: string, id: string, statement: string) =>
      call(
        `/challenges/${encodeURIComponent(id)}/proof-note`,
        token,
        z.object({ saved: z.boolean() }),
        { statement },
      ),
    finalize: (token: string, id: string) =>
      call(
        `/challenges/${encodeURIComponent(id)}/finalize`,
        token,
        z.object({ outcome: z.object({ status: z.string() }) }),
        {},
      ),
  };
}

const shareRow = z.object({
  participantId: z.string(),
  displayName: z.string(),
  amountAtomic: z.string(),
  role: z.string(),
});

export function boardSession(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
) {
  return payoutSession(storage);
}
