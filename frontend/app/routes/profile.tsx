import { useState } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";

import type { Route } from "./+types/profile";
import { Avatar } from "~/components/avatar";
import { CountUp } from "~/components/count-up";
import { Icon } from "~/components/icon";
import { fetchProfileSnapshot } from "~/lib/api";
import type {
  ProfileArbiter,
  ProfileStat,
  UserProfile,
  WalletBalance,
} from "~/lib/contracts";
import { EASE } from "~/lib/motion";
import { ICON_TILE, NOTE_TONE } from "~/lib/tones";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Profile · Goal Digger" }];
}

export async function clientLoader() {
  return fetchProfileSnapshot();
}

/* ------------------------------ presentation ----------------------------- */

/** `bcrt1q9vx7…83fk` — the design shows a shortened address next to a copy button. */
function shortAddress(address: string) {
  if (address.length <= 18) return address;
  return `${address.slice(0, 11)}...${address.slice(-4)}`;
}

/* ------------------------------- components ------------------------------ */

function ProfileHero({ profile }: { profile: UserProfile }) {
  const [copied, setCopied] = useState(false);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(profile.walletAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be blocked; the address is visible either way.
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200/80 bg-gradient-to-r from-white to-indigo-50/50 p-6 shadow-sm sm:p-8">
      <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <div className="shrink-0">
            <Avatar
              label={`${profile.name} profile photo`}
              className="h-24 w-24 ring-4 ring-indigo-100"
            />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                {profile.name}
              </h1>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
                {profile.handle}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200/70 bg-white px-2.5 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="font-mono text-xs text-slate-500">
                  Mutinynet:{" "}
                  <span className="font-semibold text-slate-700">
                    {shortAddress(profile.walletAddress)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={copyAddress}
                  title="Copy wallet address"
                  className="cursor-pointer text-slate-400 transition hover:text-indigo-600"
                >
                  <Icon
                    name={copied ? "check" : "content_copy"}
                    className="text-[15px]"
                  />
                </button>
              </div>
              <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <Icon name="dns" className="text-[15px] text-indigo-400" />
                Node: {profile.node}
              </span>
            </div>
          </div>
        </div>

        <div className="flex w-full shrink-0 items-center gap-2.5 sm:w-auto">
          <button
            type="button"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 sm:flex-none"
          >
            <Icon name="edit" className="text-[17px]" />
            Edit Profile
          </button>
          <Link
            to="/wallet"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 sm:flex-none"
          >
            <Icon name="account_balance" className="text-[17px]" />
            Deposit / Cashout
          </Link>
          <button
            type="button"
            title="Settings"
            className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-700"
          >
            <Icon name="settings" className="text-[18px]" />
          </button>
        </div>
      </div>
    </section>
  );
}

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
        <span className="text-3xl font-extrabold tracking-tight text-slate-900">
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

function ArbiterCard({ arbiter }: { arbiter: ProfileArbiter }) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-indigo-50 p-1">
          <img
            src="/panda-avatar.png"
            alt=""
            className="h-full w-full rounded-xl object-cover"
          />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-base font-bold text-slate-900">
              {arbiter.name}
            </h3>
            {arbiter.verified ? (
              <Icon
                name="verified"
                filled
                className="text-[18px] text-emerald-500"
              />
            ) : null}
          </div>
          <span className="text-xs font-medium text-slate-500">
            {arbiter.role}
          </span>
        </div>
      </div>

      <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
        {arbiter.quote.map((segment, index) => (
          <span
            key={index}
            className={
              segment.emphasis
                ? segment.emphasis === "emerald"
                  ? "font-bold text-emerald-600"
                  : "font-bold text-violet-600"
                : segment.bold
                  ? "font-bold text-slate-900"
                  : undefined
            }
          >
            {segment.text}
          </span>
        ))}
      </p>

      <div className="mt-4 flex flex-col gap-2">
        {arbiter.rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between text-xs"
          >
            <span className="font-medium text-slate-500">{row.label}</span>
            <span
              className={`font-mono font-bold ${
                row.tone === "emerald" ? "text-emerald-600" : "text-slate-700"
              }`}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>

      <Link
        to="/proofs"
        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
      >
        <Icon name="policy" className="text-[16px]" />
        {arbiter.logLabel}
      </Link>
    </section>
  );
}

function BalanceCard({ balance }: { balance: WalletBalance }) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon
            name="account_balance"
            className="text-[20px] text-indigo-500"
          />
          <h3 className="text-base font-bold text-slate-900">
            Mutinynet Balance
          </h3>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold tracking-wide text-slate-500 uppercase">
          {balance.network}
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-slate-500">Available USDT</span>
          <span className="font-mono font-bold text-slate-900">
            <CountUp text={balance.usdt} delay={0.1} />{" "}
            <span className="text-xs font-semibold text-slate-400">USDT</span>
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-slate-500">Lightning tBTC</span>
          <span className="font-mono font-bold text-slate-900">
            <CountUp text={balance.tbtc} delay={0.16} />{" "}
            <span className="text-xs font-semibold text-slate-400">tBTC</span>
          </span>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 py-2.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100"
        >
          <Icon name="water_drop" className="text-[16px]" />
          Claim Faucet
        </button>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <Icon name="history" className="text-[16px]" />
          History
        </button>
      </div>
    </section>
  );
}

/* --------------------------------- screen -------------------------------- */

export default function Profile({ loaderData }: Route.ComponentProps) {
  const { profile, stats, arbiter, balance } = loaderData;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 lg:px-8">
      <ProfileHero profile={profile} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {stats.map((stat, index) => (
          <StatCard key={stat.id} stat={stat} index={index} />
        ))}
      </div>

      {/* Stakes, wins and created pools are board filters now, so the profile
          keeps only identity, balance and the arbiter. */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <BalanceCard balance={balance} />
        <ArbiterCard arbiter={arbiter} />
      </div>
    </main>
  );
}
