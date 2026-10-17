import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";

import type { Route } from "./+types/challenge";
import {
  BoardError,
  boardSession,
  createBoardClient,
  type BoardChallenge,
} from "~/lib/board";
import { waitForStake, stakeProgress } from "~/lib/payment-confirmation";
import { createPayoutClient } from "~/lib/payouts";
import { formatAtomic, createAndPayStake, clearUnconfirmedStakeRequest, MISSED_CONFIRMATION } from "~/lib/wallet";

const payouts = createPayoutClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? "/api",
});

const client = createBoardClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? "/api",
});

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
  const token = boardSession(localStorage).read();
  if (!token) {
    try {
      return {
        challenge: await client.getPublic(params.challengeId),
        viewerId: null,
        problem: null,
      };
    } catch (cause) {
      return {
        challenge: null,
        viewerId: null,
        problem:
          cause instanceof BoardError && cause.status === 404
            ? "Challenge not found."
            : cause instanceof Error
              ? cause.message
              : "The challenge could not be read.",
      };
    }
  }
  try {
    const [challenge, me] = await Promise.all([
      client.get(token, params.challengeId),
      client.me(token),
    ]);
    return { challenge, viewerId: me.participant.id, problem: null };
  } catch (cause) {
    if (cause instanceof BoardError && cause.status === 401) {
      boardSession(localStorage).clear();
      return {
        challenge: null,
        problem: "Sign in on the challenges page to read this challenge.",
        viewerId: null,
      };
    }
    return {
      challenge: null,
      viewerId: null,
      problem:
        cause instanceof BoardError && cause.status === 404
          ? "Challenge not found."
          : cause instanceof Error
            ? cause.message
            : "The challenge could not be read.",
    };
  }
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
  const { problem, viewerId } = loaderData;
  const [challenge, setChallenge] = useState(loaderData.challenge);
  useEffect(() => {
    setChallenge(loaderData.challenge);
  }, [loaderData.challenge]);
  if (!challenge) {
    return (
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-8 lg:px-8">
        <Link
          to="/challenges"
          className="text-xs font-semibold text-slate-500 transition hover:text-indigo-600"
        >
          ← All challenges
        </Link>
        <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
          {problem}
        </p>
      </main>
    );
  }

  const fields = [
    { label: "Creator stake", value: `${challenge.stakeUsdt} USDT` },
    {
      label: "Eligible pool",
      value: challenge.poolUsdt ? `${challenge.poolUsdt} USDT` : "— USDT",
    },
    { label: "Confirmed pool", value: `${challenge.confirmedPoolUsdt} USDT` },
    { label: "Proof source", value: challenge.proofSource },
    { label: "Success rule", value: challenge.successRule },
    {
      label: "Visibility",
      value: challenge.visibility === "solo" ? "Solo" : "Public",
    },
    {
      label: "Forfeit",
      value:
        challenge.forfeit === "burn"
          ? "Burn"
          : challenge.forfeit === "rollover"
            ? "Rollover"
            : challenge.forfeit === "donate"
              ? `Donate${challenge.charity ? ` to ${challenge.charity}` : ""}`
              : "Not recorded",
    },
    { label: "Betting cutoff", value: formatDeadline(challenge.bettingCutoff) },
    { label: "Starts", value: formatDeadline(challenge.startsAt) },
    { label: "Proof deadline", value: formatDeadline(challenge.proofDeadline) },
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
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase ${challenge.badge}`}
          >
            {challenge.statusLabel}
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
              <span className="mt-1 block text-sm font-bold text-slate-900">
                {field.value}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-6 text-sm text-slate-600">{challenge.note}</p>
        <PrizeShares
          challengeId={challenge.id}
          creatorId={challenge.creatorId}
          viewerId={viewerId}
          deadline={challenge.proofDeadline}
          onChanged={setChallenge}
        />
        {viewerId === challenge.creatorId ? (
          <PublishPanel challenge={challenge} onPublished={setChallenge} />
        ) : (
          <BetPanel challenge={challenge} viewerId={viewerId} onChanged={setChallenge} />
        )}
      </div>
    </main>
  );
}

function PrizeShares({
  challengeId,
  creatorId,
  viewerId,
  deadline,
  onChanged,
}: {
  challengeId: string;
  creatorId: string;
  viewerId: string | null;
  deadline: string;
  onChanged: (challenge: BoardChallenge) => void;
}) {
  const [shares, setShares] = useState<Awaited<
    ReturnType<ReturnType<typeof createBoardClient>["prizeShares"]>
  > | null>(null);
  const [statement, setStatement] = useState("");
  const [invoice, setInvoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const passed = Date.now() >= Date.parse(deadline);

  useEffect(() => {
    let active = true;
    client
      .prizeShares(challengeId)
      .then((result) => {
        if (active) setShares(result);
      })
      .catch(() => {
        if (active) setShares(null);
      });
    return () => {
      active = false;
    };
  }, [challengeId]);

  async function saveProof() {
    const token = boardSession(localStorage).read();
    if (!token || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await client.saveProof(token, challengeId, statement.trim());
      setNote(
        result.review.verdict === "accepted"
          ? `Goaly accepted this proof: ${result.review.reason} The challenge is not settled yet.`
          : `Goaly rejected this proof: ${result.review.reason} You can submit clearer evidence before the deadline.`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function settle() {
    const token = boardSession(localStorage).read();
    if (!token || busy) return;
    setBusy(true);
    setError("");
    try {
      await client.finalize(token, challengeId);
      await payouts.calculate(challengeId, token);
      onChanged(await client.get(token, challengeId));
      setNote("The prize shares are settled. A winner claims with a WDK receive invoice.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function claim() {
    const token = boardSession(localStorage).read();
    if (!token || busy) return;
    setBusy(true);
    setError("");
    try {
      await payouts.prepare(challengeId, token, invoice.trim());
      await payouts.execute(challengeId, token);
      setNote("WDK accepted the prize share payment.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The request failed.");
    } finally {
      setBusy(false);
    }
  }

  const mine = shares
    ? [...shares.success, ...shares.failure].find((row) => row.participantId === viewerId)
    : null;

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h2 className="text-sm font-bold text-slate-900">Prize shares</h2>
      <p className="mt-2 text-sm text-slate-600">
        {shares?.rule ??
          "If the creator proves the goal, the creator receives the pool. If not, opponents share the pool in proportion to their stakes. WDK pays each share."}
      </p>
      {shares ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ShareList title="Creator proves the goal" rows={shares.success} />
          <ShareList title="Creator misses the goal" rows={shares.failure} />
        </div>
      ) : null}
      {viewerId === creatorId && !passed ? (
        <label className="mt-4 block text-sm font-semibold text-slate-800">
          Proof statement
          <textarea
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-normal"
            maxLength={1000}
            value={statement}
            onChange={(event) => setStatement(event.target.value)}
          />
          <button
            type="button"
            className="mt-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
            disabled={busy || statement.trim().length < 3}
            onClick={saveProof}
          >
            Save proof
          </button>
        </label>
      ) : null}
      {viewerId && passed ? (
        <button
          type="button"
          className="mt-4 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
          disabled={busy}
          onClick={settle}
        >
          Settle prize
        </button>
      ) : null}
      {viewerId && mine ? (
        <label className="mt-4 block text-sm font-semibold text-slate-800">
          WDK receive invoice for your share
          <input
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-normal"
            value={invoice}
            onChange={(event) => setInvoice(event.target.value)}
            placeholder="rgb:..."
          />
          <button
            type="button"
            className="mt-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-800 disabled:opacity-50"
            disabled={busy || !invoice.trim().startsWith("rgb:")}
            onClick={claim}
          >
            Claim share with WDK
          </button>
        </label>
      ) : null}
      {note ? <p role="status" className="mt-3 text-sm text-slate-600">{note}</p> : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function ShareList({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ participantId: string; displayName: string; amountAtomic: string }>;
}) {
  return (
    <div>
      <h3 className="text-xs font-bold tracking-wide text-slate-500 uppercase">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-1 text-sm text-slate-500">No share yet.</p>
      ) : (
        <ul className="mt-1 text-sm text-slate-800">
          {rows.map((row) => (
            <li key={row.participantId}>
              {row.displayName}: {formatShare(row.amountAtomic)} USDT
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatShare(value: string): string {
  try {
    return formatAtomic(value, 6);
  } catch {
    return value;
  }
}

function BetPanel({
  challenge,
  viewerId,
  onChanged,
}: {
  challenge: BoardChallenge;
  viewerId: string | null;
  onChanged: (challenge: BoardChallenge) => void;
}) {
  const [stake, setStake] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [invoice, setInvoice] = useState("");
  const [walletNote, setWalletNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [checkAttempt, setCheckAttempt] = useState(0);
  useEffect(() => {
    const token = boardSession(localStorage).read();
    if (!confirming || !token || confirmed) return;
    const abort = new AbortController();
    waitForStake({
      check: () => client.checkBet(token, challenge.id),
      onStatus: (status) => setWalletNote(stakeProgress(status)),
      complete: async () => {
        const next = await client.get(token, challenge.id);
        if (abort.signal.aborted) return;
        setConfirmed(true);
        setError("");
        setWalletNote("Payment confirmed. Your bet joined the pool.");
        onChanged(next);
      },
      signal: abort.signal,
    }).catch((cause) => {
      if (abort.signal.aborted) return;
      setWalletNote("");
      setError(cause instanceof Error ? cause.message : "Payment check failed.");
    });
    return () => abort.abort();
  }, [confirming, challenge.id, confirmed, checkAttempt]);
  const open = challenge.status === "open" && challenge.visibility !== "solo";
  if (challenge.status !== "open") return null;
  if (challenge.visibility === "solo") {
    return (
      <p className="mt-6 text-sm text-slate-500">
        This challenge does not accept bets.
      </p>
    );
  }
  if (!open) return null;
  if (!viewerId) {
    return (
      <p className="mt-6 text-sm text-slate-600">
        <Link to="/challenges" className="font-semibold text-indigo-600">
          Create a participant
        </Link>{" "}
        to bet against this challenge.
      </p>
    );
  }

  async function bet() {
    const token = boardSession(localStorage).read();
    if (!token || busy) return;
    setBusy(true);
    setError("");
    setConfirming(false);
    try {
      setWalletNote(MISSED_CONFIRMATION);
      const note = await createAndPayStake({
        createInvoice: () => client.placeBet(token, challenge.id, stake),
        checkPayment: () => client.checkBet(token, challenge.id),
        onInvoice: (result) => setInvoice(result.invoice),
        storage: localStorage,
        provider: window.rgb,
      });
      setConfirming(true);
      setWalletNote(note);
    } catch (cause) {
      setWalletNote("");
      setError(cause instanceof Error ? cause.message : "The request failed.");
    } finally {
      setBusy(false);
    }
  }

  function checkBet() {
    setError("");
    setConfirming(true);
    setCheckAttempt((attempt) => attempt + 1);
  }

  const showBetForm = !confirming && !confirmed;

  return (
    <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-5">
      {showBetForm ? <label className="text-sm font-semibold text-slate-800">
        Bet against this challenge
        <input
          className="mt-2 w-40 rounded-xl border border-slate-300 px-3 py-3 text-sm font-normal"
          inputMode="decimal"
          value={stake}
          onChange={(event) => setStake(event.target.value)}
        />
        <span className="ml-2 font-normal text-slate-500">test USDT</span>
      </label> : null}
      {showBetForm ? <button
        type="button"
        className="w-fit rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
        disabled={busy}
        onClick={bet}
      >
        {busy ? "Please wait…" : "Bet against and approve in wallet"}
      </button> : null}
      {error && invoice ? (
        <p className="break-all rounded-xl bg-slate-50 p-3 font-mono text-xs text-slate-700">
          {invoice}
        </p>
      ) : null}
      {walletNote ? <p role="status" className="text-sm text-slate-600">{walletNote}</p> : null}

      {error && invoice ? (
        <button
          type="button"
          className="w-fit rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-800 disabled:opacity-50"
          disabled={busy}
          onClick={checkBet}
        >
          Check bet payment
        </button>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      <p className="text-sm text-slate-500">
        Approve the payment from your own KaleidoSwap wallet on Mutinynet.
        Your bet joins the pool automatically after confirmation.
      </p>
    </div>
  );
}

function PublishPanel({
  challenge,
  onPublished,
}: {
  challenge: BoardChallenge;
  onPublished: (challenge: BoardChallenge) => void;
}) {
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const notice =
    typeof location.state?.paymentNotice === "string" ? location.state.paymentNotice : "";
  const arrivedWithError = Boolean(location.state?.paymentError && notice);
  const [error, setError] = useState(arrivedWithError ? notice : "");
  const [invoice, setInvoice] = useState("");
  const [confirming, setConfirming] = useState(Boolean(notice) && !arrivedWithError);
  const [walletNote, setWalletNote] = useState(arrivedWithError ? "" : notice);
  const needsStake = challenge.status === "draft" || challenge.status === "funding_review";
  const canPublish = challenge.status === "funded";
  const [checkAttempt, setCheckAttempt] = useState(0);
  useEffect(() => {
    const token = boardSession(localStorage).read();
    if (!token || (!canPublish && !(needsStake && confirming))) return;
    const abort = new AbortController();
    const finish = async () => {
      let next = await client.get(token, challenge.id);
      if (abort.signal.aborted) return;
      if (next.status === "funded") next = await client.publish(token, challenge.id);
      if (abort.signal.aborted) return;
      if (next.status !== "open" && next.status !== "betting_closed") {
        throw Error("The stake is not confirmed yet. The challenge stays a draft.");
      }
      setError("");
      setWalletNote("Payment confirmed. Challenge published.");
      onPublished(next);
    };
    const operation = canPublish
      ? finish()
      : waitForStake({
          check: () => client.checkStake(token, challenge.id),
          onStatus: (status) => setWalletNote(stakeProgress(status)),
          complete: finish,
          signal: abort.signal,
        });
    operation.catch((cause) => {
      if (abort.signal.aborted) return;
      setWalletNote("");
      setError(cause instanceof Error ? cause.message : "Payment check failed.");
    });
    return () => abort.abort();
  }, [confirming, challenge.id, needsStake, canPublish, checkAttempt]);

  useEffect(() => {
    if (!needsStake) return;
    let active = true;
    const token = boardSession(localStorage).read();
    if (!token) return;
    client
      .createStakeInvoice(token, challenge.id)
      .then(async (result) => {
        if (!active) return;
        setInvoice(result.invoice);
        const marker = localStorage.getItem(`goal-digger-stake-send:${result.invoice}`);
        if (result.status === "credited" || result.status === "pending" || (marker && marker !== "requested")) {
          setConfirming(true);
          setWalletNote((note: string) => note || stakeProgress(result.status));
        } else if (marker === "requested") {
          setBusy(true);
          setWalletNote("Checking whether the stake left the wallet…");
          try {
            const live = await client.checkStake(token, challenge.id);
            if (!active) return;
            if (live.status === "credited" || live.status === "pending") {
              setConfirming(true);
              setWalletNote(stakeProgress(live.status));
              return;
            }
            if (live.status !== "awaiting_payment") {
              throw Error("The payment needs review. Check its status before trying again.");
            }
            setWalletNote("");
            setError(
              (current: string) =>
                current ||
                "The previous wallet request has no confirmed result. The vault has not received it yet. Check payment before any further action.",
            );
          } catch (cause) {
            if (!active) return;
            setWalletNote("");
            setError(cause instanceof Error ? cause.message : "The request failed.");
          } finally {
            if (active) setBusy(false);
          }
        }
      })
      .catch((cause) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "The request failed.");
      });
    return () => {
      active = false;
    };
  }, [challenge.id, needsStake]);

  if (!needsStake && !canPublish) return null;

  async function createInvoice() {
    const token = boardSession(localStorage).read();
    if (!token || busy) return;
    setBusy(true);
    setError("");
    setConfirming(false);
    try {
      setWalletNote(MISSED_CONFIRMATION);
      const note = await createAndPayStake({
        createInvoice: () => client.createStakeInvoice(token, challenge.id),
        checkPayment: () => client.checkStake(token, challenge.id),
        onInvoice: (result) => setInvoice(result.invoice),
        storage: localStorage,
        provider: window.rgb,
      });
      setConfirming(true);
      setWalletNote(note);
    } catch (cause) {
      setWalletNote("");
      setError(cause instanceof Error ? cause.message : "The request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function retryAfterActivityCheck() {
    const token = boardSession(localStorage).read();
    if (!token || busy || !invoice) return;
    if (!window.confirm("Only continue if KaleidoSwap Activity shows no outgoing or pending payment for this stake. Did you check Activity and close all old approval windows?")) return;
    setBusy(true);
    setError("");
    try {
      await clearUnconfirmedStakeRequest({
        invoice,
        walletActivityChecked: true,
        storage: localStorage,
        checkPayment: () => client.checkStake(token, challenge.id),
      });
      setConfirming(false);
      setWalletNote("The previous request is reset. Choose Approve stake in wallet for one new request.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Payment check failed.");
    } finally {
      setBusy(false);
    }
  }

  function checkPayment() {
    setError("");
    setConfirming(true);
    setCheckAttempt((attempt) => attempt + 1);
  }

  return (
    <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-5">
      {needsStake && !confirming ? (
        <button
          type="button"
          className="w-fit rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
          disabled={busy}
          onClick={createInvoice}
        >
          {busy ? "Please wait…" : "Approve stake in wallet"}
        </button>
      ) : null}
      {error && invoice ? (
        <p className="break-all rounded-xl bg-slate-50 p-3 font-mono text-xs text-slate-700">
          {invoice}
        </p>
      ) : null}
      {walletNote ? <p role="status" className="text-sm text-slate-600">{walletNote}</p> : null}

      {error && invoice ? (
        <button
          type="button"
          className="w-fit rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-800 disabled:opacity-50"
          disabled={busy}
          onClick={checkPayment}
        >
          Check payment
        </button>
      ) : null}
      {error && invoice && localStorage.getItem(`goal-digger-stake-send:${invoice}`) === "requested" ? (
        <button
          type="button"
          className="w-fit rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-800 disabled:opacity-50"
          disabled={busy}
          onClick={retryAfterActivityCheck}
        >
          Retry after checking wallet Activity
        </button>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      {needsStake ? (
        <p className="text-sm text-slate-500">
          KaleidoSwap opens a separate Chrome window for this stake. The challenge
          publishes after that payment is confirmed.
        </p>
      ) : null}
    </div>
  );
}
