import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";

import type { Route } from "./+types/ledger";
import { boardSession, createBoardClient, type BoardChallenge } from "~/lib/board";
import { formatAtomic } from "~/lib/wallet";

const client = createBoardClient({ baseUrl: import.meta.env.VITE_API_BASE_URL ?? "/api" });
type LedgerSnapshot = Awaited<ReturnType<typeof client.ledger>>;
type LedgerRow = { challenge: BoardChallenge; ledger: LedgerSnapshot };

export function meta({}: Route.MetaArgs) {
  return [{ title: "Pool Ledger · Goal Digger" }];
}

function shortTxid(txid: string) {
  return `${txid.slice(0, 12)}…${txid.slice(-10)}`;
}

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";
}

export default function Ledger() {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  const load = useCallback(async (session: string) => {
    setBusy(true);
    setError("");
    try {
      const [publicChallenges, ownedChallenges] = await Promise.all([
        client.listPublic(),
        client.list(session),
      ]);
      const all = new Map<string, BoardChallenge>();
      for (const challenge of [...publicChallenges, ...ownedChallenges]) all.set(challenge.id, challenge);
      const funded = [...all.values()]
        .filter((challenge) => BigInt(challenge.confirmedPoolUsdt.replace(".", "")) > 0n)
        .slice(0, 50);
      const snapshots = await Promise.all(
        funded.map(async (challenge) => ({
          challenge,
          ledger: await client.ledger(session, challenge.id),
        })),
      );
      setRows(snapshots);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read the pool ledger.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const saved = boardSession(localStorage).read();
    if (!saved) {
      setReady(true);
      return;
    }
    client.me(saved)
      .then(async () => {
        if (!active) return;
        setToken(saved);
        await load(saved);
      })
      .catch((cause) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Could not restore participant.");
          if ((cause as { status?: number }).status === 401) boardSession(localStorage).clear();
        }
      })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [load]);

  async function copy(txid: string) {
    try {
      await navigator.clipboard.writeText(txid);
      setCopied(txid);
      window.setTimeout(() => setCopied(""), 1600);
    } catch {
      setError("Clipboard access is unavailable. Select the transaction ID to copy it.");
    }
  }

  const confirmedTotal = rows.reduce((sum, row) => sum + BigInt(row.ledger.confirmedPoolAtomic), 0n);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 lg:px-8">
      <section className="relative overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-white via-indigo-50/70 to-slate-50 p-6 shadow-sm sm:p-9">
        <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-20 h-64 w-64 rounded-full bg-indigo-200/30 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/80 px-3 py-1 text-[11px] font-bold tracking-wide text-indigo-700 uppercase">Live API · confirmed deposits</span>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Pool ledger</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">Confirmed stake credits for published pools, with their recorded amounts, participant roles, and transfer IDs. This is a read-only view.</p>
          </div>
          {token ? <button type="button" disabled={busy} onClick={() => void load(token)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700 disabled:opacity-50">{busy ? "Refreshing…" : "Refresh ledger"}</button> : null}
        </div>
      </section>

      {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p> : null}
      {!ready || busy ? <p role="status" className="text-sm text-slate-500">Reading confirmed pool credits…</p> : null}

      {ready && !token ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Connect your participant</h2>
          <p className="mt-2 text-sm text-slate-600">A participant session is required to read pool entries. This page never requests a wallet payment.</p>
          <Link to="/profile" className="mt-4 inline-flex rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-700">Open profile</Link>
        </section>
      ) : null}

      {ready && token && !busy && rows.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">No confirmed pool credits yet</h2>
          <p className="mt-2 text-sm text-slate-600">Pending transfers are not listed. Refresh after the challenge service confirms a payment.</p>
          <Link to="/challenges" className="mt-4 inline-flex font-bold text-indigo-600 hover:text-indigo-800">Browse challenges →</Link>
        </section>
      ) : null}

      {rows.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">Visible confirmed pools</p>
              <p className="mt-1 text-2xl font-extrabold text-slate-900">{formatAtomic(confirmedTotal.toString(), 6)} <span className="text-sm font-bold text-slate-400">USDT</span></p>
            </div>
            <span className="text-xs text-slate-500">{rows.length} {rows.length === 1 ? "pool" : "pools"} · newest challenges first</span>
          </div>
          <div className="space-y-4">
            {rows.map(({ challenge, ledger }) => (
              <article key={challenge.id} className="overflow-hidden rounded-2xl border border-slate-200">
                <header className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4">
                  <div>
                    <Link to={`/challenges/${challenge.id}`} className="font-bold text-slate-900 transition hover:text-indigo-700">{challenge.title}</Link>
                    <p className="mt-1 text-xs text-slate-500">{challenge.statusLabel} · confirmed {formatAtomic(ledger.confirmedPoolAtomic, 6)} USDT · eligible {formatAtomic(ledger.eligiblePoolAtomic, 6)} USDT</p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold text-slate-600">{ledger.entries.length} credited {ledger.entries.length === 1 ? "stake" : "stakes"}</span>
                </header>
                {ledger.entries.length === 0 ? (
                  <p className="p-4 text-sm text-slate-500">The service has no confirmed stake credits for this pool.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[680px] text-left text-sm">
                      <thead className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        <tr><th className="px-4 py-3">Participant</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Credit time</th><th className="px-4 py-3">Transfer ID</th><th className="px-4 py-3">Pool status</th></tr>
                      </thead>
                      <tbody>
                        {ledger.entries.map((entry) => (
                          <tr key={`${entry.txid}-${entry.participantId}`} className="border-t border-slate-100">
                            <td className="px-4 py-3 font-semibold text-slate-800">{entry.participant}</td>
                            <td className="px-4 py-3 capitalize text-slate-600">{entry.role}</td>
                            <td className="px-4 py-3 font-mono font-bold text-slate-900">{formatAtomic(entry.amountAtomic, 6)} USDT</td>
                            <td className="px-4 py-3 whitespace-nowrap text-slate-600">{dateTime(entry.creditedAt)}</td>
                            <td className="px-4 py-3">
                              <button type="button" onClick={() => void copy(entry.txid)} title={entry.txid} className="font-mono text-xs font-semibold text-indigo-700 hover:text-indigo-900">{copied === entry.txid ? "Copied" : shortTxid(entry.txid)}</button>
                            </td>
                            <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${entry.eligible ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{entry.eligible ? "Eligible" : "Review"}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-slate-500">Only credits confirmed by the challenge service appear. Transfer IDs are copied from the recorded receipt. Pending and uncredited wallet transfers are not shown.</p>
        </section>
      ) : null}
    </main>
  );
}
