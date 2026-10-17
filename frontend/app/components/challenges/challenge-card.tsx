import { Link } from "react-router";
import type { BoardChallenge } from "~/lib/board";

function formatDeadline(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
}

export function ChallengeCard({ challenge }: { challenge: BoardChallenge }) {
  return (
    <article
      className={`group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md ${challenge.hover}`}
    >
      <div>
        <div className="mb-3.5 flex items-center justify-between">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase ${challenge.badge}`}
          >
            {challenge.statusLabel}
          </span>
          <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
            {challenge.template} {challenge.templateEmoji}
          </span>
        </div>

        <Link to={`/challenges/${challenge.id}`} className="block">
          <h3
            className={`text-base leading-snug font-bold text-slate-900 transition-colors ${challenge.titleHover}`}
          >
            {challenge.title}
          </h3>
        </Link>
        <p className="mt-1 text-xs font-medium text-slate-400">
          by{" "}
          <span className="font-semibold text-slate-700">
            {challenge.creator}
          </span>
        </p>
        <p className="mt-1 mb-5 text-xs font-semibold text-slate-600">
          Deadline {formatDeadline(challenge.proofDeadline)}
        </p>
      </div>

      <div className="border-t border-slate-100 pt-3">
        <div className="mb-3 flex items-center justify-between text-xs">
          <span className="font-medium text-slate-500">
            Stake{" "}
            <strong className="ml-1 font-mono text-sm font-bold text-slate-900">
              {challenge.stakeUsdt} USDT
            </strong>
          </span>
          {challenge.poolUsdt ? (
            <span className="font-medium text-slate-500">
              Eligible{" "}
              <span
                className={`ml-1 font-mono text-sm font-bold ${challenge.poolTone}`}
              >
                {challenge.poolUsdt} USDT
              </span>
            </span>
          ) : (
            <span className="font-mono text-xs font-medium text-slate-400">
              Eligible — USDT
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-slate-50 p-2.5 text-xs text-slate-600">
          <span className="truncate text-[11px] font-medium text-slate-500">
            {challenge.proofSource}
          </span>
          <span className="shrink-0 text-[11px] font-semibold text-indigo-600">
            {challenge.note}
          </span>
        </div>
      </div>
    </article>
  );
}
