import { Link } from "react-router";

import type { Route } from "./+types/home";
import { fetchHealth } from "~/lib/api";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Goal Digger 💪" },
    {
      name: "description",
      content:
        "Stake USDT on a goal, let others bet against you, and prove it before the deadline.",
    },
  ];
}

// SPA mode: data fetching happens in the browser, so this must be a
// `clientLoader` rather than a `loader`.
export async function clientLoader() {
  return { health: await fetchHealth() };
}

const STEPS = [
  {
    title: "Stake and declare",
    body: "Pick a challenge, stake USDT, and publish the success rule, proof source, and deadlines.",
  },
  {
    title: "Others bet against you",
    body: "Every confirmed opponent stake joins one pool. Terms lock after the first bet.",
  },
  {
    title: "Prove it or lose it",
    body: "Meet the rule before the deadline to take the whole pool. Otherwise opponents split it.",
  },
];

export default function Home({ loaderData }: Route.ComponentProps) {
  const { health } = loaderData;

  return (
    <div className="flex flex-col gap-12">
      <section className="hero rounded-box bg-base-200 py-16">
        <div className="hero-content text-center">
          <div className="max-w-2xl">
            <span className="badge badge-primary badge-outline mb-4">
              RGB · QVAC · Bitcoin
            </span>
            <h1 className="text-5xl font-black tracking-tight">
              Challenge yourself, on Bitcoin
            </h1>
            <p className="py-6 text-lg opacity-80">
              Stake USDT on completing your own goal. Everyone else bets against
              you. Promise kept, you take the pool — promise broken, they split
              it.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/challenges" className="btn btn-primary">
                Browse challenges
              </Link>
              <Link to="/challenges" className="btn btn-outline">
                How the pool works
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-6 text-2xl font-bold">How it works</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <div key={step.title} className="card bg-base-200">
              <div className="card-body">
                <span className="badge badge-primary">{index + 1}</span>
                <h3 className="card-title text-base">{step.title}</h3>
                <p className="text-sm opacity-80">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card bg-base-200">
        <div className="card-body">
          <h2 className="card-title text-base">Integration status</h2>
          <p className="text-sm opacity-70">
            Placeholder until the local QVAC model and RGB node are wired in.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="badge badge-ghost">
              API: {health.status}
            </span>
            <span className="badge badge-ghost">
              RGB: {health.integrations.rgb}
            </span>
            <span className="badge badge-ghost">
              QVAC: {health.integrations.qvac}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
