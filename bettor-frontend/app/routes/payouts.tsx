import { useCallback, useEffect, useRef, useState } from "react";
import { Award } from "~/components/payouts/award";
import { button, client, input, message, type Session } from "~/components/payouts/shared";
import { payoutSession, PayoutError } from "~/lib/payouts";
import type { PayoutChallenge } from "~/lib/payouts";

export function meta() {
  return [{ title: "Your payouts · Goal Digger" }];
}

export default function Payouts() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [challenges, setChallenges] = useState<PayoutChallenge[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  const offset = useRef(0);
  const [more, setMore] = useState(false);
  const disconnect = useCallback(() => {
    generation.current++;
    payoutSession(localStorage).clear();
    setSession(null);
    setChallenges([]);
    offset.current = 0;
    setMore(false);
    setSelected("");
    setError("");
    setNote("");
  }, []);
  const expired = useCallback(() => {
    disconnect();
    setError("Your participant session expired. Restore a valid session to continue.");
  }, [disconnect]);
  useEffect(() => {
    let active = true;
    const token = payoutSession(localStorage).read();
    if (!token) {
      setReady(true);
      return;
    }
    client
      .me(token)
      .then((result) => {
        if (active) setSession({ token, participant: result.participant });
      })
      .catch((e) => {
        if (active) {
          setError(message(e));
          if (e instanceof PayoutError && e.status === 401)
            payoutSession(localStorage).clear();
        }
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  const load = useCallback(
    async (append = false) => {
      if (!session) return;
      const version = generation.current;
      setLoading(true);
      try {
        const result = await client.list(session.token, append ? offset.current : 0);
        if (version === generation.current) {
          offset.current = (append ? offset.current : 0) + result.challenges.length;
          setMore(result.challenges.length === 100);
          setChallenges((previous) =>
            [
              ...(append ? previous : []),
              ...result.challenges.filter((c) => c.outcome !== null),
            ].filter((c, i, all) => all.findIndex((item) => item.id === c.id) === i),
          );
          setError("");
        }
      } catch (e) {
        if (version === generation.current) {
          if (e instanceof PayoutError && e.status === 401) expired();
          else setError(message(e));
        }
      } finally {
        if (version === generation.current) setLoading(false);
      }
    },
    [session, expired],
  );
  useEffect(() => {
    load();
  }, [load]);
  async function connect(restore: boolean) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNote("");
    try {
      const result = restore
        ? { ...(await client.me(key.trim())), token: key.trim() }
        : await client.createSession(name.trim());
      generation.current++;
      setSession(result);
      setKey("");
      if (!payoutSession(localStorage).save(result.token))
        setNote("The session could not be saved. Keep this page open.");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const current = challenges.find((c) => c.id === selected);
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 lg:px-8">
      <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">
        Live payouts · Mutinynet
      </p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
        Your winnings, in your wallet
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-slate-600">
        Claim your share from a completed challenge. Use the same participant session that
        created your challenge or placed your stake.
      </p>
      {error && (
        <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </p>
      )}
      {note && (
        <p role="status" className="mt-4 text-sm text-slate-600">
          {note}
        </p>
      )}
      {!ready ? (
        <p role="status" className="mt-8 text-sm text-slate-500">
          Restore participant session…
        </p>
      ) : !session ? (
        <section className="mt-8 grid gap-6 md:grid-cols-2">
          <form
            className="rounded-2xl border border-slate-200 bg-white p-6"
            onSubmit={(e) => {
              e.preventDefault();
              connect(true);
            }}
          >
            <h2 className="text-lg font-bold text-slate-900">Restore your participant</h2>
            <p className="my-3 text-sm text-slate-600">
              Use your existing participant access key. A new name does not recover
              previous stakes.
            </p>
            <label htmlFor="participant-key" className="text-sm font-semibold">
              Participant access key
            </label>
            <input
              id="participant-key"
              className={`${input} mt-2`}
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              pattern="[a-f0-9]{64}"
              required
            />
            <p className="mt-2 text-xs text-slate-500">
              This is your Goal Digger session key. Never enter a wallet seed phrase.
            </p>
            <button className={`${button} mt-4`} disabled={busy}>
              Restore participant
            </button>
          </form>
          <form
            className="rounded-2xl border border-slate-200 bg-white p-6"
            onSubmit={(e) => {
              e.preventDefault();
              connect(false);
            }}
          >
            <h2 className="text-lg font-bold text-slate-900">New to the local demo?</h2>
            <p className="my-3 text-sm text-slate-600">
              Create a participant for future challenges. This does not claim another
              participant’s winnings.
            </p>
            <label htmlFor="participant-name" className="text-sm font-semibold">
              Your display name
            </label>
            <input
              id="participant-name"
              className={`${input} mt-2`}
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <button className={`${button} mt-4`} disabled={busy || !name.trim()}>
              Create demo participant
            </button>
          </form>
        </section>
      ) : (
        <>
          <div className="my-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <div>
              <p className="text-sm font-bold text-slate-900">
                {session.participant.displayName}
              </p>
              <p className="text-xs text-slate-500">
                Participant session active. Keep your access key to restore it elsewhere.
              </p>
            </div>
            <div className="flex flex-wrap gap-4 text-xs font-semibold text-indigo-600">
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(session.token);
                    setNote("Participant access key copied. Keep it private.");
                  } catch {
                    setNote("The access key could not be copied.");
                  }
                }}
              >
                Copy access key
              </button>
              <button disabled={loading} onClick={() => load()}>
                Refresh challenges
              </button>
              <button onClick={disconnect}>Disconnect participant</button>
            </div>
          </div>
          <div className="grid items-start gap-6 lg:grid-cols-[300px_1fr]">
            <section aria-label="Completed challenges" className="space-y-3">
              {loading && (
                <p role="status" className="text-sm text-slate-500">
                  Read completed challenges…
                </p>
              )}
              {!loading && !challenges.length && (
                <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
                  No completed challenges are available yet.
                </p>
              )}
              {challenges.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  aria-pressed={selected === c.id}
                  className={`w-full rounded-xl border p-4 text-left transition ${selected === c.id ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-white hover:border-indigo-300"}`}
                >
                  <span className="block text-sm font-bold text-slate-900">
                    {c.title}
                  </span>
                  <span className="mt-2 block text-xs text-slate-500">
                    {c.status === "funding_review"
                      ? "Funds need review"
                      : c.outcome?.status === "success"
                        ? "Creator succeeded"
                        : "Opponents won"}
                  </span>
                </button>
              ))}
              {more && (
                <button
                  className="text-sm font-semibold text-indigo-600 disabled:opacity-50"
                  disabled={loading}
                  onClick={() => load(true)}
                >
                  Load older challenges
                </button>
              )}
            </section>
            {current ? (
              <Award
                key={`${session.token}:${current.id}`}
                challenge={current}
                session={session}
                onExpired={expired}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
                Select a completed challenge to check your payout.
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}
