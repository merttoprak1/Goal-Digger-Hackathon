import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { AnimatePresence, motion } from "motion/react";

import type { Route } from "./+types/wallet";
import { CountUp } from "~/components/count-up";
import { Icon } from "~/components/icon";
import { fetchWalletSnapshot } from "~/lib/api";
import type {
  EscrowHold,
  ProfileStat,
  WalletEntry,
  WalletEntryKind,
  WalletSnapshot,
} from "~/lib/contracts";
import { EASE } from "~/lib/motion";
import { BADGE_TONE, ICON_TILE, NOTE_TONE } from "~/lib/tones";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Wallet · Goal Digger" }];
}

export async function clientLoader() {
  return fetchWalletSnapshot();
}

/* ------------------------------ presentation ----------------------------- */

/** `bcrt1q9vx7…83fk` — the same shortening the profile uses. */
function shortAddress(address: string) {
  if (address.length <= 18) return address;
  return `${address.slice(0, 10)}…${address.slice(-6)}`;
}

/** Icon, tint and sign colour for each way money can move. */
const ENTRY_LOOK: Record<
  WalletEntryKind,
  { icon: string; tile: string; amount: string }
> = {
  deposit: {
    icon: "arrow_downward",
    tile: ICON_TILE.emerald,
    amount: "text-emerald-600",
  },
  payout: { icon: "redeem", tile: ICON_TILE.indigo, amount: "text-emerald-600" },
  release: { icon: "undo", tile: ICON_TILE.blue, amount: "text-emerald-600" },
  lock: { icon: "lock", tile: ICON_TILE.slate, amount: "text-slate-700" },
  fee: {
    icon: "local_gas_station",
    tile: ICON_TILE.slate,
    amount: "text-slate-400",
  },
};

const PAGE_HEAD = "text-xl font-bold tracking-tight text-slate-900";

/** Which drawer is open under the balance card. */
type Pane = "deposit" | "cashout";

/* ---------------------------------- hero --------------------------------- */

function WalletHero({
  wallet,
  pane,
  onToggle,
}: {
  wallet: WalletSnapshot;
  pane: Pane | null;
  onToggle: (next: Pane) => void;
}) {
  const [copied, setCopied] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(wallet.address);
    } catch {
      // Clipboard access can be blocked over plain http; the chip still confirms.
    }
    setCopied(true);
    timers.current.push(window.setTimeout(() => setCopied(false), 1600));
  }

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
            <Icon name="account_balance_wallet" className="text-[16px]" />
            Available Balance
          </span>

          <div className="mt-3 flex flex-wrap items-baseline gap-2">
            <span className="font-mono text-4xl font-extrabold tracking-tight sm:text-5xl">
              <CountUp text={wallet.availableUsdt} delay={0.1} />
            </span>
            <span className="text-base font-bold text-indigo-300">USDT</span>
          </div>

          <p className="mt-2 text-xs font-medium text-slate-400">
            Plus{" "}
            <span className="font-mono font-bold text-slate-200">
              {wallet.lockedUsdt} USDT
            </span>{" "}
            locked in escrow •{" "}
            <span className="font-mono font-bold text-slate-200">
              {wallet.tbtc} tBTC
            </span>{" "}
            paying the fees
          </p>

          <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="font-mono text-xs text-slate-300">
              {wallet.network}:{" "}
              <span className="font-semibold text-white">
                {shortAddress(wallet.address)}
              </span>
            </span>
            <button
              type="button"
              onClick={copyAddress}
              title="Copy deposit address"
              className="cursor-pointer text-slate-400 transition hover:text-white"
            >
              {/* Keyed swap, so the tick never waits on an exit animation. */}
              <motion.span
                key={copied ? "copied" : "copy"}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.18, ease: EASE }}
                className="block"
              >
                <Icon name={copied ? "check" : "content_copy"} className="text-[15px]" />
              </motion.span>
            </button>
          </div>
        </div>

        <div className="flex shrink-0 gap-2.5">
          <button
            type="button"
            onClick={() => onToggle("deposit")}
            className={[
              "flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm transition",
              pane === "deposit"
                ? "bg-indigo-200"
                : "bg-white hover:bg-slate-100",
            ].join(" ")}
          >
            <Icon name="south_west" className="text-[17px]" />
            Deposit
          </button>
          <button
            type="button"
            onClick={() => onToggle("cashout")}
            className={[
              "flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-bold transition",
              pane === "cashout"
                ? "border-white/30 bg-white/20 text-white"
                : "border-white/15 bg-white/5 text-white hover:bg-white/10",
            ].join(" ")}
          >
            <Icon name="north_east" className="text-[17px]" />
            Cashout
          </button>
        </div>
      </div>
    </motion.section>
  );
}

/** The deposit / cashout drawer, revealed from under the balance card. */
function ActionPane({
  pane,
  wallet,
}: {
  pane: Pane;
  wallet: WalletSnapshot;
}) {
  const [copied, setCopied] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(wallet.address);
    } catch {
      // Same clipboard caveat as the chip above.
    }
    setCopied(true);
    timers.current.push(window.setTimeout(() => setCopied(false), 1600));
  }

  return (
    <motion.div
      key={pane}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.32, ease: EASE }}
      className="overflow-hidden"
    >
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        {pane === "deposit" ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span
                className={`grid h-9 w-9 place-items-center rounded-xl ${ICON_TILE.indigo}`}
              >
                <Icon name="south_west" className="text-[19px]" />
              </span>
              <div>
                <h2 className={PAGE_HEAD}>Fund the wallet</h2>
                <span className="text-xs font-medium text-slate-500">
                  Send USDT or tBTC on {wallet.network}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-slate-50 px-3.5 py-3">
              <span className="min-w-0 flex-1 font-mono text-xs break-all text-slate-600">
                {wallet.address}
              </span>
              <button
                type="button"
                onClick={copyAddress}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition hover:bg-indigo-700"
              >
                <Icon name={copied ? "check" : "content_copy"} className="text-[15px]" />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            <p className="flex items-start gap-2 text-xs leading-relaxed font-medium text-slate-500">
              <Icon name="info" className="mt-px text-[15px] text-slate-400" />
              Two confirmations and the balance updates. Stakes only ever leave
              this wallet through a funded Taproot escrow.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span
                className={`grid h-9 w-9 place-items-center rounded-xl ${ICON_TILE.slate}`}
              >
                <Icon name="north_east" className="text-[19px]" />
              </span>
              <div>
                <h2 className={PAGE_HEAD}>Cash out to your wallet</h2>
                <span className="text-xs font-medium text-slate-500">
                  Mutinynet • settles in about two blocks
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 px-3.5 py-2.5">
                <span className="block text-[10px] font-bold tracking-wide text-slate-400 uppercase">
                  Available
                </span>
                <span className="mt-0.5 block font-mono text-sm font-bold text-slate-900">
                  {wallet.availableUsdt}
                  <span className="ml-1 text-[10px] font-semibold text-slate-400">
                    USDT
                  </span>
                </span>
              </div>
              <div className="rounded-xl bg-slate-50 px-3.5 py-2.5">
                <span className="block text-[10px] font-bold tracking-wide text-slate-400 uppercase">
                  Miner Fee
                </span>
                <span className="mt-0.5 block font-mono text-sm font-bold text-slate-900">
                  0.00000412
                  <span className="ml-1 text-[10px] font-semibold text-slate-400">
                    tBTC
                  </span>
                </span>
              </div>
              <div className="rounded-xl bg-slate-50 px-3.5 py-2.5">
                <span className="block text-[10px] font-bold tracking-wide text-slate-400 uppercase">
                  Destination
                </span>
                <span className="mt-0.5 block font-mono text-sm font-bold text-slate-900">
                  {shortAddress(wallet.address)}
                </span>
              </div>
            </div>

            <p className="flex items-start gap-2 rounded-xl border border-slate-200/70 bg-slate-50 px-3.5 py-3 text-xs leading-relaxed font-medium text-slate-500">
              <Icon name="lock" className="mt-px text-[15px] text-slate-400" />
              Cashouts unlock with the RGB escrow rail, so a release always
              signs against the same contract that funded the pool.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ---------------------------------- cards -------------------------------- */

function StatCard({ stat, index }: { stat: ProfileStat; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.07, ease: EASE }}
      className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-bold tracking-wider text-slate-500 uppercase">
          {stat.label}
        </span>
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${ICON_TILE[stat.iconTone]}`}
        >
          <Icon name={stat.icon} className="text-[19px]" />
        </span>
      </div>
      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="font-mono text-3xl font-extrabold tracking-tight text-slate-900">
          <CountUp text={stat.value} delay={index * 0.07} />
        </span>
        {stat.unit ? (
          <span className="text-sm font-semibold text-slate-500">
            {stat.unit}
          </span>
        ) : null}
      </div>
      <p className={`mt-2 text-xs font-semibold ${NOTE_TONE[stat.noteTone]}`}>
        {stat.note}
      </p>
    </motion.div>
  );
}

function EscrowCard({
  holds,
  lockedUsdt,
}: {
  holds: EscrowHold[];
  lockedUsdt: string;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.2, ease: EASE }}
      className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-bold tracking-wider text-slate-500 uppercase">
          <Icon name="lock_clock" className="text-[17px] text-indigo-500" />
          In Escrow
        </span>
        <span className="font-mono text-sm font-bold text-slate-900">
          {lockedUsdt}
          <span className="ml-1 text-[10px] font-semibold text-slate-400">
            USDT
          </span>
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {holds.map((hold, index) => (
          <motion.div
            key={hold.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.28 + index * 0.06, ease: EASE }}
          >
            <Link
              to={`/challenges/${hold.id}`}
              className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-slate-50 px-3.5 py-3 transition hover:border-indigo-200 hover:bg-white"
            >
              <div className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-800 transition group-hover:text-indigo-600">
                  {hold.title}
                </span>
                <span className="mt-0.5 block font-mono text-[11px] text-slate-400">
                  {hold.via}
                </span>
              </div>
              <span className="flex shrink-0 items-center gap-1">
                <span className="font-mono text-sm font-bold text-slate-900">
                  {hold.amountUsdt}
                </span>
                <Icon
                  name="chevron_right"
                  className="text-[17px] text-slate-300 transition group-hover:text-indigo-500"
                />
              </span>
            </Link>
          </motion.div>
        ))}
      </div>

      <p className="flex items-start gap-2 rounded-xl border border-slate-200/70 bg-slate-50 px-3.5 py-3 text-[11px] leading-relaxed font-medium text-slate-500">
        <Icon name="info" className="mt-px text-[14px] text-slate-400" />
        Escrowed USDT sits in a Taproot output. It leaves only when the arbiter
        signs a settlement or the deadline passes.
      </p>
    </motion.section>
  );
}

function ActivityCard({ entries }: { entries: WalletEntry[] }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.24, ease: EASE }}
      className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-bold tracking-wider text-slate-500 uppercase">
          <Icon name="receipt_long" className="text-[17px] text-indigo-500" />
          Activity
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">
          Last 30 days
        </span>
      </div>

      <ul className="flex flex-col">
        {entries.map((entry, index) => {
          const look = ENTRY_LOOK[entry.kind];
          return (
            <motion.li
              key={entry.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.3,
                delay: 0.3 + index * 0.05,
                ease: EASE,
              }}
              className="flex items-center gap-3.5 border-b border-slate-100 py-3 last:border-b-0 last:pb-0 first:pt-0"
            >
              <span
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${look.tile}`}
              >
                <Icon name={look.icon} className="text-[19px]" />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">
                    {entry.label}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${BADGE_TONE[entry.badge.tone]}`}
                  >
                    {entry.badge.label}
                  </span>
                </div>
                <span className="mt-0.5 block truncate text-xs font-medium text-slate-500">
                  {entry.detail}
                </span>
              </div>

              <div className="shrink-0 text-right">
                <span
                  className={`block font-mono text-sm font-bold ${look.amount}`}
                >
                  {entry.amount}
                  <span className="ml-1 text-[10px] font-semibold text-slate-400">
                    {entry.unit}
                  </span>
                </span>
                <span className="mt-0.5 block text-[11px] font-medium text-slate-400">
                  {entry.timestamp}
                </span>
              </div>
            </motion.li>
          );
        })}
      </ul>
    </motion.section>
  );
}

/* ---------------------------------- page --------------------------------- */

export default function Wallet({ loaderData }: Route.ComponentProps) {
  const wallet = loaderData;
  const [pane, setPane] = useState<Pane | null>(null);

  function togglePane(next: Pane) {
    setPane((current) => (current === next ? null : next));
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Wallet
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Stakes, escrow and the tBTC that pays for them.
          </p>
        </div>
        <Link
          to="/payout"
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:text-indigo-600"
        >
          <Icon name="redeem" className="text-[16px]" />
          Collect payouts
        </Link>
      </div>

      <WalletHero wallet={wallet} pane={pane} onToggle={togglePane} />

      <AnimatePresence initial={false}>
        {pane ? <ActionPane key={pane} pane={pane} wallet={wallet} /> : null}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {wallet.stats.map((stat, index) => (
          <StatCard key={stat.id} stat={stat} index={index} />
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <EscrowCard holds={wallet.holds} lockedUsdt={wallet.lockedUsdt} />
        </div>
        <div className="lg:col-span-7">
          <ActivityCard entries={wallet.entries} />
        </div>
      </div>
    </main>
  );
}
