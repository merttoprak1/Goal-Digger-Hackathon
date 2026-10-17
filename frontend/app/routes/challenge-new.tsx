import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

import type { Route } from "./+types/challenge-new";
import { Icon } from "~/components/icon";
import { createAndPayStake } from "~/lib/wallet";
import { boardSession, createBoardClient } from "~/lib/board";
import { useGoalyBuilderDraft } from "~/lib/goaly-builder-context";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Create Challenge · Goal Digger" }];
}

/* --------------------------------- config -------------------------------- */

const HORIZON_OPTIONS = [3, 5, 7, 14];

function localDeadline(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const VISIBILITY = [
  {
    id: "public" as const,
    icon: "public",
    title: "Public Arena",
    badge: "Peer-to-Peer",
    body: "Anyone can bet against your goal. If you succeed, you sweep the pool. If you fail, opponent bettors share the pool in proportion to their stakes.",
    perk: "Winnings go to the people who bet against a failed challenge.",
  },
  {
    id: "solo" as const,
    icon: "lock",
    title: "Solo Discipline",
    badge: null,
    body: "A private challenge with no community counter-bets.",
    perk: "No opponent bets are accepted.",
  },
];

const QUICK_STAKES = ["1", "5", "10", "25"];

type VisibilityId = "public" | "solo";
/* --------------------------------- screen -------------------------------- */

export default function ChallengeNew() {
  const navigate = useNavigate();
  const { draft: sharedDraft, setDraft: setSharedDraft } = useGoalyBuilderDraft();

  const [visibility, setVisibility] = useState<VisibilityId>("public");
  const [challengeTitle, setChallengeTitle] = useState("");
  const [successRule, setSuccessRule] = useState("");
  const [proofSource, setProofSource] = useState("");
  const [stake, setStake] = useState("5.00");
  const [horizonDays, setHorizonDays] = useState(5);
  const [deadline, setDeadline] = useState(() =>
    localDeadline(new Date(Date.now() + 5 * 86_400_000)),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participantName, setParticipantName] = useState("");
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    setSignedIn(Boolean(boardSession(localStorage).read()));
  }, []);

  useEffect(() => {
    setSharedDraft({
      title: challengeTitle,
      successRule,
      proofSource,
      stake,
      deadline,
      visibility,
    });
  }, [challengeTitle, successRule, proofSource, stake, deadline, visibility, setSharedDraft]);

  useEffect(() => {
    const applyDraft = (event: Event) => {
      const draft = (event as CustomEvent<typeof sharedDraft>).detail;
      if (!draft) return;
      setChallengeTitle(draft.title);
      setSuccessRule(draft.successRule);
      setProofSource(draft.proofSource);
      setStake(draft.stake);
      setDeadline(draft.deadline);
      setVisibility(draft.visibility);
    };
    window.addEventListener("goaly:builder:apply", applyDraft);
    return () => window.removeEventListener("goaly:builder:apply", applyDraft);
  }, []);

  const stakeNumber = Number(stake);

  async function submit() {
    if (pending) return;
    setError(null);
    if (!challengeTitle.trim() || !successRule.trim() || !proofSource.trim()) {
      setError("Complete the title, success rule, and proof source before continuing.");
      return;
    }
    if (!Number.isFinite(stakeNumber) || stakeNumber < 1) {
      setError("Stake at least 1 USDT.");
      return;
    }
    if (!Number.isFinite(new Date(deadline).getTime()) || new Date(deadline).getTime() <= Date.now()) {
      setError("Choose a future proof deadline.");
      return;
    }
    setPending(true);

    const amount =
      Number.isFinite(stakeNumber) && stakeNumber > 0
        ? String(stakeNumber)
        : "1";

    try {
      const client = createBoardClient({
        baseUrl: import.meta.env.VITE_API_BASE_URL ?? "/api",
      });
      let token = boardSession(localStorage).read();
      if (!token) {
        const name = participantName.trim();
        if (!name) {
          throw new Error("Enter your display name. It owns this challenge.");
        }
        const created = await client.createSession(name);
        if (!boardSession(localStorage).save(created.token)) {
          throw new Error("This browser could not save your participant.");
        }
        token = created.token;
        setSignedIn(true);
      }
      const saved = await client.createCustom(token, {
        title: challengeTitle.trim(),
        successRule: successRule.trim(),
        stake: amount,
        proofDeadline: new Date(deadline).toISOString(),
        proofSource: proofSource.trim(),
        visibility,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      let paymentNotice: string;
      let paymentError = false;
      try {
        paymentNotice = await createAndPayStake({
          createInvoice: () => client.createStakeInvoice(token!, saved.id),
          checkPayment: () => client.checkStake(token!, saved.id),
          storage: localStorage,
          provider: window.rgb,
        });
      } catch (cause) {
        paymentError = true;
        paymentNotice = cause instanceof Error ? cause.message : "Wallet approval failed. Retry from your saved challenge.";
      }
      // Always open the saved draft, even if payment fails. Never create it twice.
      navigate(`/challenges/${saved.id}`, { state: { paymentNotice, paymentError } });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not create the challenge.",
      );
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <Link
            to="/challenges"
            className="flex items-center gap-1 font-semibold text-slate-500 transition hover:text-indigo-600"
          >
            <Icon name="arrow_back" className="text-[15px]" />
            Back to Arena
          </Link>
          <span className="text-slate-300">/</span>
          <span className="font-semibold text-slate-700">
            Custom Challenge Builder
          </span>
        </div>

        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold text-slate-600">
          Wallet payment requires your approval.
        </span>
      </div>

      <div className="flex flex-col items-center gap-2.5 border-b border-slate-200 pb-6 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Create Custom Challenge
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-500 sm:text-base">
          Type the title, the success rule, and the proof source. Create
          challenge asks you to deposit the stake in test USDT. Other people
          can bet after that payment is confirmed.
        </p>
      </div>

      <div className="flex flex-col gap-5">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">
              Write the challenge
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Goaly can fill these draft fields from your chat. Review and edit
              every value before you create the challenge.
            </p>
            <label className="mt-4 block text-sm font-semibold text-slate-800">
              Title
              <input
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-normal"
                maxLength={120}
                value={challengeTitle}
                onChange={(event) => setChallengeTitle(event.target.value)}
                placeholder="Wake at 06:30 for 5 days"
                required
              />
            </label>
            <label className="mt-4 block text-sm font-semibold text-slate-800">
              Success rule
              <textarea
                className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-normal"
                maxLength={1000}
                value={successRule}
                onChange={(event) => setSuccessRule(event.target.value)}
                placeholder="Solve the fresh math problem before the deadline."
                required
              />
            </label>
            <label className="mt-4 block text-sm font-semibold text-slate-800">
              Proof source
              <input
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-normal"
                maxLength={500}
                value={proofSource}
                onChange={(event) => setProofSource(event.target.value)}
                placeholder="A dated photo, a race result, or a server time check."
                required
              />
            </label>
          </section>
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <Icon name="explore" className="text-[20px] text-indigo-500" />
                Step 1: Challenge Visibility &amp; Ruleset
              </h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                Challenge settings
              </span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {VISIBILITY.map((option) => {
                const selected = visibility === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setVisibility(option.id)}
                    className={[
                      "flex cursor-pointer flex-col gap-2 rounded-2xl border p-4 text-left transition",
                      selected
                        ? "border-indigo-400 bg-indigo-50/70 ring-1 ring-indigo-200"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <span
                          className={`grid h-8 w-8 place-items-center rounded-lg ${
                            selected
                              ? "bg-indigo-600 text-white"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          <Icon name={option.icon} className="text-[18px]" />
                        </span>
                        <span className="text-sm font-bold text-slate-900">
                          {option.title}
                        </span>
                      </span>
                      {option.badge ? (
                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                          {option.badge}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-500">
                      {option.body}
                    </p>
                    <span className="text-[11px] font-semibold text-indigo-600">
                      {option.perk}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Icon
                name="savings"
                className="text-[20px] text-emerald-500"
              />
              Step 2: Stake Vault &amp; Proof Parameters
            </h2>

            <div className="mt-4 grid gap-5 md:grid-cols-2">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700">
                    Staking Commitment
                  </span>
                </div>

                <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 transition focus-within:border-indigo-500 focus-within:bg-white">
                  <span className="text-sm font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    min={1}
                    step="0.01"
                    value={stake}
                    onChange={(event) => setStake(event.target.value)}
                    className="min-w-0 flex-1 border-0 bg-transparent font-mono text-sm font-bold text-slate-900 focus:outline-none"
                  />
                  <span className="font-mono text-[10px] font-bold text-slate-400">
                    USDT
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {QUICK_STAKES.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setStake(amount)}
                      className={[
                        "cursor-pointer rounded-lg px-2.5 py-1 font-mono text-[11px] font-bold transition",
                        stake === amount
                          ? "bg-emerald-600 text-white"
                          : "border border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-700",
                      ].join(" ")}
                    >
                      {amount} USDT
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700">
                    Challenge Horizon
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    Days until the proof deadline
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <span className="flex items-center gap-2">
                    <Icon
                      name="calendar_month"
                      className="text-[18px] text-indigo-500"
                    />
                    <span className="font-mono text-sm font-bold text-slate-900">
                      {horizonDays} Consecutive Days
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const index = HORIZON_OPTIONS.indexOf(horizonDays);
                      const days = HORIZON_OPTIONS[(index + 1) % HORIZON_OPTIONS.length];
                      setHorizonDays(days);
                      setDeadline(localDeadline(new Date(Date.now() + days * 86_400_000)));
                    }}
                    className="cursor-pointer text-[11px] font-bold text-indigo-600 transition hover:text-indigo-800"
                  >
                    Adjust
                  </button>
                </div>

                <label className="mt-3 block text-xs font-bold text-slate-700">
                  Proof deadline
                  <input
                    type="datetime-local"
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-normal"
                    value={deadline}
                    onChange={(event) => setDeadline(event.target.value)}
                    required
                  />
                </label>
                <div className="mt-2 flex items-center justify-between text-[11px] font-medium text-slate-400">
                  <span>Betting closes one hour and one minute before this deadline.</span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200/70 bg-slate-50 px-4 py-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
                <Icon name="health_and_safety" className="text-[19px]" />
              </span>
              <div>
                <p className="text-xs font-bold text-slate-800">
                  Declared proof source: {proofSource.trim() || "Not entered yet"}
                </p>
                <p className="text-[10px] text-slate-400">
                  This text is saved with the draft. It does not connect a device.
                </p>
              </div>
            </div>

            <p className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
              <Icon
                name="verified_user"
                className="text-[15px] text-emerald-500"
              />
              The stake invoice is paid from KaleidoSwap after you approve the transfer.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-500">Draft stake</span>
                <span className="font-mono font-bold text-slate-900">
                  {Number.isFinite(stakeNumber) && stakeNumber > 0
                    ? stakeNumber.toFixed(2)
                    : "0.00"}{" "}
                  <span className="text-[10px] font-semibold text-slate-400">
                    USDT
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-500">Proof horizon</span>
                <span className="font-mono font-bold text-slate-900">
                  {horizonDays} days
                </span>
              </div>
            </div>

            {error ? (
              <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                {error}
              </p>
            ) : null}

            {signedIn ? null : (
              <label className="mt-5 block text-sm font-semibold text-slate-800">
                Your display name
                <input
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-normal"
                  maxLength={60}
                  value={participantName}
                  onChange={(event) => setParticipantName(event.target.value)}
                  required
                />
              </label>
            )}

            <div className="mt-5 border-t border-slate-100 pt-4">
              <button
                type="button"
                disabled={pending}
                onClick={() => submit()}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <Icon name="bolt" className="text-[18px]" />
                )}
                {pending ? "Preparing the stake invoice…" : "Create challenge and deposit"}
              </button>
            </div>

            <p className="mt-3 text-center text-[11px] font-medium text-slate-400">
              KaleidoSwap opens a Chrome window named KaleidoSwap - Confirmation
              after the stake invoice is ready. The challenge stays private until
              that payment is confirmed.
            </p>
          </section>
      </div>
    </main>
  );
}
