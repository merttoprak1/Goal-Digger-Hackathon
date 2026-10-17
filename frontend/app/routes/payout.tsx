import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { AnimatePresence, motion } from "motion/react";

import type { Route } from "./+types/payout";
import { CountUp } from "~/components/count-up";
import { Icon } from "~/components/icon";
import { claimPayout, fetchPayoutSnapshot } from "~/lib/api";
import type {
  PayoutHistoryRow,
  PayoutPool,
  PayoutSnapshot,
} from "~/lib/contracts";
import { EASE } from "~/lib/motion";
import { BADGE_TONE, ICON_TILE } from "~/lib/tones";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Payouts · Goal Digger" }];
}

export async function clientLoader() {
  return fetchPayoutSnapshot();
}

/* ------------------------------ presentation ----------------------------- */

type TabID = "claimable" | "pending" | "history";

const RESULT_BADGE: Record<PayoutHistoryRow["result"], string> = {
  won: BADGE_TONE.emerald,
  lost: "border-slate-200 bg-slate-50 text-slate-500",
};

/** Shown when a tab has nothing in it yet. */
function EmptyTab({ icon, title, hint }: { icon: string; title: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <Icon name={icon} className="text-[32px] text-slate-300" />
      <p className="mt-3 text-sm font-bold text-slate-700">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

/* ---------------------------------- hero --------------------------------- */

function PayoutHero({
  snapshot,
  onClaimNext,
}: {
  snapshot: PayoutSnapshot;
  onClaimNext: () => void;
}) {
  const next = snapshot.claimable[0];

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
      className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-sm sm:p-8"
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <span className="flex items-center gap-2 text-xs font-bold tracking-wider text-indigo-300 uppercase">
            <Icon name="redeem" className="text-[16px]" />
            Claimable Now
          </span>

          <div className="mt-3 flex flex-wrap items-baseline gap-2">
            <span className="font-mono text-4xl font-extrabold tracking-tight sm:text-5xl">
              <CountUp text={snapshot.claimableUsdt} delay={0.1} />
            </span>
            <span className="text-base font-bold text-indigo-300">USDT</span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <Icon name="emoji_events" className="text-[15px] text-amber-400" />
              Lifetime{" "}
              <span className="font-mono font-bold text-slate-200">
                {snapshot.lifetimeUsdt} USDT
              </span>
              <span className="text-slate-500">
                over {snapshot.settledCount} pools
              </span>
            </span>
            <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <Icon name="hourglass_top" className="text-[15px] text-indigo-300" />
              Awaiting{" "}
              <span className="font-mono font-bold text-slate-200">
                {snapshot.awaitingUsdt} USDT
              </span>
            </span>
          </div>
        </div>

        {next ? (
          <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="min-w-0">
              <span className="block text-[10px] font-bold tracking-wide text-indigo-300 uppercase">
                Next up
              </span>
              <span className="mt-0.5 block truncate text-sm font-bold">
                {next.title}
              </span>
            </div>
            <motion.button
              type="button"
              onClick={onClaimNext}
              whileTap={{ scale: 0.97 }}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-slate-900 shadow-sm transition hover:bg-slate-100"
            >
              <Icon name="bolt" className="text-[15px]" />
              Claim {next.amountUsdt}
            </motion.button>
          </div>
        ) : null}
      </div>
    </motion.section>
  );
}

/* ---------------------------------- cards -------------------------------- */

function ClaimCard({
  pool,
  index,
  busy,
  onClaim,
}: {
  pool: PayoutPool;
  index: number;
  busy: boolean;
  onClaim: () => void;
}) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.3, delay: index * 0.07, ease: EASE }}
      whileHover={{ y: -2 }}
      className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <span
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${ICON_TILE.emerald}`}
          >
            <Icon name="redeem" className="text-[22px]" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base leading-snug font-bold text-slate-900">
                {pool.title}
              </h3>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${BADGE_TONE.emerald}`}
              >
                Won
              </span>
            </div>
            <p className="mt-1 flex items-start gap-1.5 text-xs font-medium text-slate-500">
              <Icon
                name="verified_user"
                className="mt-px text-[15px] shrink-0 text-slate-400"
              />
              {pool.proof}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="rounded-xl bg-slate-50 px-3.5 py-2 text-center">
            <span className="block text-[10px] font-bold tracking-wide text-slate-400 uppercase">
              Payout
            </span>
            <span className="mt-0.5 block font-mono text-sm font-bold text-emerald-600">
              {pool.amountUsdt}
              <span className="ml-1 text-[10px] font-semibold text-slate-400">
                USDT
              </span>
            </span>
          </div>

          <motion.button
            type="button"
            onClick={onClaim}
            disabled={busy}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-wait"
          >
            {busy ? (
              <>
                <span className="loading loading-spinner loading-xs text-white" />
                Signing
              </>
            ) : (
              <>
                <Icon name="account_balance_wallet" className="text-[15px]" />
                Claim
              </>
            )}
          </motion.button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-slate-50 px-4 py-3">
        <span className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <Icon name="schedule" className="text-[16px] text-slate-400" />
          {pool.timing}
        </span>
        <span className="font-mono text-[11px] font-bold text-slate-500">
          Instant release
        </span>
      </div>
    </motion.article>
  );
}

function PendingCard({ pool, index }: { pool: PayoutPool; index: number }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.07, ease: EASE }}
      className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3.5">
          <span
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${ICON_TILE.blue}`}
          >
            <Icon name="hourglass_top" className="text-[22px]" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base leading-snug font-bold text-slate-900">
                {pool.title}
              </h3>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${BADGE_TONE.blue}`}
              >
                Awaiting
              </span>
            </div>
            <p className="mt-1 text-xs font-medium text-slate-500">
              {pool.proof}
            </p>
          </div>
        </div>

        <span className="shrink-0 rounded-xl bg-slate-50 px-3.5 py-2 text-center">
          <span className="block text-[10px] font-bold tracking-wide text-slate-400 uppercase">
            Locked In
          </span>
          <span className="mt-0.5 block font-mono text-sm font-bold text-indigo-600">
            {pool.amountUsdt}
            <span className="ml-1 text-[10px] font-semibold text-slate-400">
              USDT
            </span>
          </span>
        </span>
      </div>

      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <motion.div
          initial={{ width: "0%" }}
          animate={{ width: "68%" }}
          transition={{ duration: 0.9, delay: 0.3, ease: EASE }}
          className="h-full rounded-full bg-indigo-500"
        />
      </div>

      <p className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
        <Icon name="schedule" className="text-[15px] text-slate-400" />
        {pool.timing}
      </p>
    </motion.article>
  );
}

function HistoryRow({ row, index }: { row: PayoutHistoryRow; index: number }) {
  const won = row.result === "won";
  return (
    <motion.li
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: EASE }}
      className="flex items-center gap-3.5 border-b border-slate-100 py-3.5 last:border-b-0 last:pb-0 first:pt-0"
    >
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
          won ? ICON_TILE.emerald : ICON_TILE.slate
        }`}
      >
        <Icon name={won ? "emoji_events" : "close"} className="text-[19px]" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-slate-900">{row.title}</span>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${RESULT_BADGE[row.result]}`}
          >
            {row.result}
          </span>
        </div>
        <span className="mt-0.5 block text-xs font-medium text-slate-500">
          Settled {row.at}
        </span>
      </div>

      <span
        className={`shrink-0 font-mono text-sm font-bold ${
          won ? "text-emerald-600" : "text-slate-400"
        }`}
      >
        {won ? "+" : "-"}
        {row.amountUsdt}
        <span className="ml-1 text-[10px] font-semibold text-slate-400">
          USDT
        </span>
      </span>
    </motion.li>
  );
}

/* ---------------------------------- page --------------------------------- */

export default function Payout({ loaderData }: Route.ComponentProps) {
  const [snapshot, setSnapshot] = useState(loaderData);
  const [tab, setTab] = useState<TabID>("claimable");
  const [claiming, setClaiming] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ amount: string; title: string } | null>(
    null,
  );
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const tabs: { id: TabID; label: string; count: number }[] = [
    { id: "claimable", label: "Claimable", count: snapshot.claimable.length },
    { id: "pending", label: "Awaiting Arbiter", count: snapshot.pending.length },
    { id: "history", label: "History", count: snapshot.history.length },
  ];

  async function claim(pool: PayoutPool) {
    if (claiming) return;
    setClaiming(pool.id);

    // Let the spinner read as real work before the ledger moves.
    await new Promise<void>((resolve) => {
      timers.current.push(window.setTimeout(resolve, 900));
    });

    try {
      setSnapshot(await claimPayout(pool.id));
      setReceipt({ amount: pool.amountUsdt, title: pool.title });
      timers.current.push(
        window.setTimeout(() => setReceipt(null), 6000),
      );
    } catch {
      // The only failure is a claim that already landed; the list is the truth.
    } finally {
      setClaiming(null);
    }
  }

  const next = snapshot.claimable[0];
  const claimNext = () => {
    if (next) void claim(next);
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Payouts
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Every pool the arbiter has settled in your favour.
          </p>
        </div>
        <Link
          to="/wallet"
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:text-indigo-600"
        >
          <Icon name="account_balance_wallet" className="text-[16px]" />
          Go to wallet
        </Link>
      </div>

      <PayoutHero snapshot={snapshot} onClaimNext={claimNext} />

      <AnimatePresence initial={false}>
        {receipt ? (
          <motion.div
            key="receipt"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                <Icon
                  name="check_circle"
                  filled
                  className="text-[18px] text-emerald-600"
                />
                <span className="font-mono font-bold">
                  +{receipt.amount} USDT
                </span>
                moved to your wallet
                <span className="hidden font-medium text-emerald-700 sm:inline">
                  • {receipt.title}
                </span>
              </span>
              <Link
                to="/wallet"
                className="flex items-center gap-1 text-xs font-bold text-emerald-700 transition hover:text-emerald-900"
              >
                View ledger
                <Icon name="arrow_forward" className="text-[15px]" />
              </Link>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {tabs.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={[
                  "relative flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-bold whitespace-nowrap transition-colors",
                  active
                    ? "text-slate-900"
                    : "text-slate-500 hover:bg-white/70 hover:text-slate-800",
                ].join(" ")}
              >
                {/* One pill, handed between tabs, as in the header nav. */}
                {active ? (
                  <motion.span
                    layoutId="payout-tab"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className="absolute inset-0 rounded-full bg-white shadow-sm ring-1 ring-slate-200/80"
                  />
                ) : null}
                <span className="relative z-10">{item.label}</span>
                <span
                  className={[
                    "relative z-10 grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[10px] font-bold",
                    active
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-500",
                  ].join(" ")}
                >
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: EASE }}
          >
            {tab === "claimable" ? (
              snapshot.claimable.length > 0 ? (
                <div className="flex flex-col gap-4">
                  <AnimatePresence initial={false}>
                    {snapshot.claimable.map((pool, index) => (
                      <ClaimCard
                        key={pool.id}
                        pool={pool}
                        index={index}
                        busy={claiming === pool.id}
                        onClaim={() => void claim(pool)}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <EmptyTab
                  icon="redeem"
                  title="Nothing waiting to be claimed"
                  hint="Settled pools land here as the arbiter closes each epoch."
                />
              )
            ) : tab === "pending" ? (
              <div className="flex flex-col gap-4">
                {snapshot.pending.map((pool, index) => (
                  <PendingCard key={pool.id} pool={pool} index={index} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <ul className="flex flex-col">
                  {snapshot.history.map((row, index) => (
                    <HistoryRow key={row.id} row={row} index={index} />
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}
