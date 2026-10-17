import { Link } from "react-router";

import type { Route } from "./+types/challenge";
import { BoardError, boardSession, createBoardClient } from "~/lib/board";

const client = createBoardClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? "/api",
});

export function meta({ data: loaderData }: Route.MetaArgs) {
  const challenge = loaderData?.challenge;
  return [
    {
      title: challenge
        ? `${challenge.title} · Goal Digger`
        : "Challenge · Goal Digger",
    },
  ];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const token = boardSession(localStorage).read();
  if (!token) {
    return {
      challenge: null,
      problem: "Sign in on the challenges page to read this challenge.",
    };
  }
  try {
    return { challenge: await client.get(token, params.challengeId), problem: null };
  } catch (cause) {
    if (cause instanceof BoardError && cause.status === 401) {
      boardSession(localStorage).clear();
      return {
        challenge: null,
        problem: "Sign in on the challenges page to read this challenge.",
      };
    }
    return {
      challenge: null,
      problem:
        cause instanceof BoardError && cause.status === 404
          ? "Challenge not found."
          : cause instanceof Error
            ? cause.message
            : "The challenge could not be read.",
    };
  }
}

function formatDeadline(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return `${parsed.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  })} UTC`;
}

export default function ChallengeDetail({ loaderData }: Route.ComponentProps) {
  const { challenge, problem } = loaderData;
  if (!challenge) {
    return (
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-8 lg:px-8">
        <Link
          to="/challenges"
          className="text-xs font-semibold text-slate-500 transition hover:text-indigo-600"
        >
          ← All challenges
        </Link>
        <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
          {problem}
        </p>
      </main>
    );
  }

  const fields = [
    { label: "Creator stake", value: `${challenge.stakeUsdt} USDT` },
    {
      label: "Eligible pool",
      value: challenge.poolUsdt ? `${challenge.poolUsdt} USDT` : "— USDT",
    },
    { label: "Confirmed pool", value: `${challenge.confirmedPoolUsdt} USDT` },
    { label: "Proof source", value: challenge.proofSource },
    { label: "Success rule", value: challenge.successRule },
    { label: "Betting cutoff", value: formatDeadline(challenge.bettingCutoff) },
    { label: "Starts", value: formatDeadline(challenge.startsAt) },
    { label: "Proof deadline", value: formatDeadline(challenge.proofDeadline) },
  ];

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 lg:px-8">
      <Link
        to="/challenges"
        className="text-xs font-semibold text-slate-500 transition hover:text-indigo-600"
      >
        ← All challenges
      </Link>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase ${challenge.badge}`}
          >
            {challenge.statusLabel}
          </span>
          <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
            {challenge.template} {challenge.templateEmoji}
          </span>
        </div>

        <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          {challenge.title}
        </h1>
        <p className="mt-1 text-sm font-medium text-slate-400">
          by{" "}
          <span className="font-semibold text-slate-700">
            {challenge.creator}
          </span>
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <div
              key={field.label}
              className="rounded-xl border border-slate-200/70 bg-slate-50 p-4"
            >
              <span className="block text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                {field.label}
              </span>
              <span className="mt-1 block text-sm font-bold text-slate-900">
                {field.value}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-6 text-sm text-slate-600">{challenge.note}</p>
      </div>
    </main>
  );
}
