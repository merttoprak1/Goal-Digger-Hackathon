import { data, Link } from "react-router";

import type { Route } from "./+types/challenge";
import { fetchChallenge } from "~/lib/api";
import { POOL_TONE, STATUS_BADGE } from "~/lib/challenge-view";

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
  const challenge = await fetchChallenge(params.challengeId);
  if (!challenge) {
    throw data("Challenge not found", { status: 404 });
  }
  return { challenge };
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
  const { challenge } = loaderData;

  const fields = [
    {
      label: "Creator Stake",
      value: `${challenge.stakeUsdt} USDT`,
      tone: "text-slate-900",
    },
    {
      label: "Opponent Pool",
      value: challenge.poolUsdt ? `${challenge.poolUsdt} USDT` : "— USDT",
      tone: challenge.poolUsdt
        ? POOL_TONE[challenge.status]
        : "text-slate-400",
    },
    {
      label: "Proof Source",
      value: challenge.proofSource,
      tone: "text-slate-900",
    },
    {
      label: "Proof Deadline",
      value: formatDeadline(challenge.proofDeadline),
      tone: "text-slate-900",
    },
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
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase ${STATUS_BADGE[challenge.status]}`}
          >
            {challenge.status}
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
              <span
                className={`mt-1 block font-mono text-sm font-bold ${field.tone}`}
              >
                {field.value}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-slate-50 p-4">
          <span className="text-xs font-semibold text-indigo-600">
            {challenge.action.kind === "button"
              ? `Available action: ${challenge.action.label}`
              : challenge.action.label}
          </span>
          <span className="text-[11px] font-medium text-slate-400">
            {challenge.action.kind === "button"
              ? "Counter-stakes open on the challenges board"
              : challenge.action.note}
          </span>
        </div>
      </div>
    </main>
  );
}
