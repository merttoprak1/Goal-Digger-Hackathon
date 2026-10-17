import { useState } from "react";
import { Link } from "react-router";

import type { Route } from "./+types/profile";
import { Avatar } from "~/components/avatar";
import { Icon } from "~/components/icon";
import { fetchProfileSnapshot } from "~/lib/api";
import type {
  ProfileArbiter,
  ProfileStake,
  ProfileStat,
  UserProfile,
  WalletBalance,
} from "~/lib/contracts";
import { ACTION_TONE, BADGE_TONE, ICON_TILE, NOTE_TONE } from "~/lib/tones";

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
          <div className="relative shrink-0">
            <Avatar
              label={`${profile.name} profile photo`}
              className="h-24 w-24 ring-4 ring-indigo-100"
            />
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-2.5 py-0.5 text-[10px] font-bold tracking-wide whitespace-nowrap text-white uppercase">
              {profile.level}
            </span>
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
          <button
            type="button"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 sm:flex-none"
          >
            <Icon name="account_balance" className="text-[17px]" />
            Deposit / Cashout
          </button>
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

function StatCard({ stat }: { stat: ProfileStat }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
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
          {stat.value}
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
    </div>
  );
}

function StakeCard({ stake }: { stake: ProfileStake }) {
  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <span
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${ICON_TILE[stake.iconTone]}`}
          >
            <Icon name={stake.icon} className="text-[22px]" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base leading-snug font-bold text-slate-900">
                {stake.title}
              </h3>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${BADGE_TONE[stake.badge.tone]}`}
              >
                {stake.badge.label}
              </span>
            </div>
            <p className="mt-1 text-xs font-medium text-slate-500">
              {stake.meta}
              {stake.urgency ? (
                <>
                  {" • "}
                  <span className="font-bold text-rose-500">
                    {stake.urgency}
                  </span>
                </>
              ) : null}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 gap-2.5">
          <div className="rounded-xl bg-slate-50 px-3.5 py-2 text-center">
            <span className="block text-[10px] font-bold tracking-wide text-slate-400 uppercase">
              Your Stake
            </span>
            <span className="mt-0.5 block font-mono text-sm font-bold text-slate-900">
              {stake.stakeUsdt}
              <span className="ml-1 text-[10px] font-semibold text-slate-400">
                USDT
              </span>
            </span>
          </div>
          <div className="rounded-xl bg-slate-50 px-3.5 py-2 text-center">
            <span className="block text-[10px] font-bold tracking-wide text-slate-400 uppercase">
              Total Pool
            </span>
            <span className="mt-0.5 block font-mono text-sm font-bold text-indigo-600">
              {stake.poolUsdt ?? "—"}
              <span className="ml-1 text-[10px] font-semibold text-slate-400">
                USDT
              </span>
            </span>
          </div>
        </div>
      </div>

      {stake.note.boxed ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-slate-50 px-4 py-3">
          <span className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <Icon
              name={stake.note.icon}
              className="text-[16px] text-slate-400"
            />
            {stake.note.text}
          </span>
          {stake.note.trailing ? (
            <span className="text-xs font-bold text-emerald-600">
              {stake.note.trailing}
            </span>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <Icon
              name={stake.note.icon}
              className="text-[16px] text-slate-400"
            />
            {stake.note.text}
          </span>
          {stake.note.trailing ? (
            <span className="font-mono text-xs font-bold text-slate-700">
              {stake.note.trailing}
            </span>
          ) : null}
        </div>
      )}

      {stake.progress ? (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-indigo-600 transition-[width] duration-500"
            style={{ width: `${stake.progress.percent}%` }}
          />
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <Icon name="verified_user" className="text-[15px] text-slate-400" />
          {stake.footer}
        </span>
        <div className="flex flex-wrap gap-2">
          {stake.actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${ACTION_TONE[action.tone]}`}
            >
              {action.icon ? (
                <Icon name={action.icon} className="text-[15px]" />
              ) : null}
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </article>
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
            {balance.usdt}{" "}
            <span className="text-xs font-semibold text-slate-400">USDT</span>
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-slate-500">Lightning tBTC</span>
          <span className="font-mono font-bold text-slate-900">
            {balance.tbtc}{" "}
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
  const { profile, stats, stakes, arbiter, balance } = loaderData;
  const [tab, setTab] = useState<"active" | "settled" | "created">("active");

  const tabs = [
    { id: "active" as const, label: "Active Stakes", count: profile.tabs.activeStakes },
    { id: "settled" as const, label: "Settled / Won", count: profile.tabs.settledWon },
    { id: "created" as const, label: "Created Pools", count: profile.tabs.createdPools },
  ];

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 lg:px-8">
      <ProfileHero profile={profile} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <StatCard key={stat.id} stat={stat} />
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-5 lg:col-span-8">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {tabs.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={[
                    "flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-bold whitespace-nowrap transition",
                    active
                      ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80"
                      : "text-slate-500 hover:bg-white/70 hover:text-slate-800",
                  ].join(" ")}
                >
                  {item.label}
                  <span
                    className={[
                      "grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[10px] font-bold",
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

          {tab === "active" ? (
            <div className="flex flex-col gap-4">
              {stakes.map((stake) => (
                <StakeCard key={stake.id} stake={stake} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <Icon
                name={tab === "settled" ? "emoji_events" : "inventory_2"}
                className="text-[32px] text-slate-300"
              />
              <p className="mt-3 text-sm font-bold text-slate-700">
                {tab === "settled"
                  ? `${profile.tabs.settledWon} settled challenges`
                  : `${profile.tabs.createdPools} created pools`}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                This list is wired to the API response — the history view is not
                designed yet.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5 lg:col-span-4">
          <ArbiterCard arbiter={arbiter} />
          <BalanceCard balance={balance} />
        </div>
      </div>
    </main>
  );
}
