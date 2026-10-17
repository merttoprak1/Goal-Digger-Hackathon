import { Link } from "react-router";

import type { Route } from "./+types/challenges";
import { fetchChallenges } from "~/lib/api";
import type { Challenge, ChallengeStatus } from "~/lib/contracts";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Challenges · Goal Digger" },
    { name: "description", content: "Open and upcoming challenges." },
  ];
}

// SPA mode: use `clientLoader` (there is no server to run a `loader`).
export async function clientLoader() {
  return { challenges: await fetchChallenges() };
}

const STATUS_BADGE: Record<ChallengeStatus, string> = {
  draft: "badge-ghost",
  open: "badge-primary",
  active: "badge-warning",
  settled: "badge-success",
  failed: "badge-error",
};

function ChallengeCard({ challenge }: { challenge: Challenge }) {
  return (
    <Link
      to={`/challenges/${challenge.id}`}
      className="card bg-base-200 transition hover:bg-base-300"
    >
      <div className="card-body gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className={`badge ${STATUS_BADGE[challenge.status]}`}>
            {challenge.status}
          </span>
          <span className="text-xs uppercase tracking-wide opacity-60">
            {challenge.template.replace("_", " ")}
          </span>
        </div>
        <h2 className="card-title text-base">{challenge.title}</h2>
        <p className="text-sm opacity-70">by {challenge.creatorName}</p>
        <div className="card-actions mt-1 items-center justify-between">
          <span className="text-sm">
            Stake <strong>{challenge.requestedStakeUsdt} USDT</strong>
          </span>
          <span className="text-xs opacity-60">
            Pool {challenge.funding.confirmedPoolUsdt ?? "—"} USDT
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function Challenges({ loaderData }: Route.ComponentProps) {
  const { challenges } = loaderData;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Challenges</h1>
          <p className="text-sm opacity-70">
            Every card shows the rule, proof source, and deadlines before you bet.
          </p>
        </div>
      </header>

      {challenges.length === 0 ? (
        <div className="alert">
          <span>No challenges yet.</span>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {challenges.map((challenge) => (
            <ChallengeCard key={challenge.id} challenge={challenge} />
          ))}
        </div>
      )}
    </div>
  );
}
