import { Link, data } from "react-router";

import type { Route } from "./+types/challenge";
import { fetchChallenge } from "~/lib/api";
import type { Challenge } from "~/lib/contracts";

export function meta({ data: loaderData }: Route.MetaArgs) {
  const title = loaderData?.challenge.title ?? "Challenge";
  return [{ title: `${title} · Goal Digger` }];
}

// SPA mode: use `clientLoader` (there is no server to run a `loader`).
export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const challenge = await fetchChallenge(params.challengeId);
  if (!challenge) {
    throw data("Challenge not found", { status: 404 });
  }
  return { challenge };
}

function formatDateTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(iso));
}

const PROOF_LABELS: Array<{ key: keyof Challenge["proof"]; label: string }> = [
  { key: "method", label: "Method" },
  { key: "source", label: "Proof source" },
  { key: "successRule", label: "Success rule" },
  { key: "retryRule", label: "Retry rule" },
  { key: "failureRule", label: "Failure rule" },
];

export default function ChallengeDetail({ loaderData }: Route.ComponentProps) {
  const { challenge } = loaderData;

  const timeline = [
    { label: "Betting closes", value: challenge.bettingClosesAt },
    { label: "Challenge starts", value: challenge.startsAt },
    { label: "Proof deadline", value: challenge.proofDeadline },
  ];

  return (
    <div className="flex flex-col gap-8">
      <Link to="/challenges" className="link link-hover text-sm opacity-70">
        ← All challenges
      </Link>

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge badge-primary badge-outline">
            {challenge.status}
          </span>
          <span className="badge badge-ghost">
            {challenge.template.replace("_", " ")}
          </span>
          <span className="text-sm opacity-70">by {challenge.creatorName}</span>
        </div>
        <h1 className="text-3xl font-bold">{challenge.title}</h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="card bg-base-200">
          <div className="card-body">
            <h2 className="card-title text-base">Fixed proof terms</h2>
            <p className="text-sm opacity-70">
              These terms are agreed before betting opens and cannot change after
              the first opponent bets.
            </p>
            <dl className="mt-2 divide-y divide-base-300">
              {PROOF_LABELS.map(({ key, label }) => (
                <div key={key} className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr]">
                  <dt className="text-sm font-medium opacity-60">{label}</dt>
                  <dd className="text-sm">{challenge.proof[key]}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <div className="flex flex-col gap-6">
          <section className="card bg-base-200">
            <div className="card-body">
              <h2 className="card-title text-base">Stake and pool</h2>
              <div className="stats stats-vertical bg-base-100">
                <div className="stat">
                  <div className="stat-title">Creator stake</div>
                  <div className="stat-value text-2xl">
                    {challenge.requestedStakeUsdt}
                  </div>
                  <div className="stat-desc">USDT requested</div>
                </div>
                <div className="stat">
                  <div className="stat-title">Confirmed pool</div>
                  <div className="stat-value text-2xl">
                    {challenge.funding.confirmedPoolUsdt ?? "—"}
                  </div>
                  <div className="stat-desc">
                    {challenge.funding.status} · {challenge.funding.network}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="card bg-base-200">
            <div className="card-body">
              <h2 className="card-title text-base">Timeline</h2>
              <ul className="flex flex-col gap-3">
                {timeline.map((item) => (
                  <li key={item.label} className="flex flex-col">
                    <span className="text-xs uppercase tracking-wide opacity-60">
                      {item.label}
                    </span>
                    <span className="text-sm">
                      {formatDateTime(item.value, challenge.timezone)}
                    </span>
                    <span className="text-xs opacity-50">{item.value}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs opacity-60">
                Timezone: {challenge.timezone}
              </p>
            </div>
          </section>
        </div>
      </div>

      <section className="alert">
        <span>
          Betting, evidence submission, and payouts are not wired up yet — build
          these screens here.
        </span>
      </section>
    </div>
  );
}
