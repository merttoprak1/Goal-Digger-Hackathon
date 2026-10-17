import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";

import type { Route } from "./+types/proofs";
import { boardSession, createBoardClient, type BoardChallenge } from "~/lib/board";

const client = createBoardClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? "/api",
});

type ProofList = Awaited<ReturnType<typeof client.mathProofs>>;
type MathProblem = Awaited<ReturnType<typeof client.createMathProblem>>["problem"];

export function meta({}: Route.MetaArgs) {
  return [{ title: "My Proofs · Goal Digger" }];
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export default function Proofs() {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [challenges, setChallenges] = useState<BoardChallenge[]>([]);
  const [proofs, setProofs] = useState<Record<string, ProofList>>({});
  const [problems, setProblems] = useState<Record<string, MathProblem>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (session: string) => {
    const rows = await client.list(session);
    const supported = rows.filter((challenge) => challenge.proofMethod === "timed_math");
    const proofResults = await Promise.all(
      supported.map(async (challenge) => [
        challenge.id,
        await client.mathProofs(session, challenge.id),
      ] as const),
    );
    setChallenges(supported);
    setProofs(Object.fromEntries(proofResults));
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
          setError(cause instanceof Error ? cause.message : "Could not read your proofs.");
          if ((cause as { status?: number }).status === 401) boardSession(localStorage).clear();
        }
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [load]);

  async function startProblem(challenge: BoardChallenge) {
    if (!token || busyId) return;
    setBusyId(challenge.id);
    setError("");
    setNotice("");
    try {
      const result = await client.createMathProblem(token, challenge.id);
      setProblems((current) => ({ ...current, [challenge.id]: result.problem }));
      setAnswers((current) => ({ ...current, [challenge.id]: "" }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create a proof problem.");
    } finally {
      setBusyId("");
    }
  }

  async function submitAnswer(challenge: BoardChallenge) {
    const problem = problems[challenge.id];
    const answer = answers[challenge.id]?.trim() ?? "";
    if (!token || !problem || !/^-?\d{1,6}$/.test(answer) || busyId) return;
    setBusyId(challenge.id);
    setError("");
    setNotice("");
    try {
      const result = await client.submitMathAnswer(token, challenge.id, {
        problemId: problem.id,
        answer,
      });
      setProofs((current) => ({
        ...current,
        [challenge.id]: {
          proofs: [...(current[challenge.id]?.proofs ?? []), result.proof],
          accepted: result.proof.status === "accepted",
        },
      }));
      setProblems((current) => {
        const next = { ...current };
        delete next[challenge.id];
        return next;
      });
      setNotice(result.proof.reason);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not submit the answer.");
    } finally {
      setBusyId("");
    }
  }

  const now = Date.now();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 lg:px-8">
      <section className="relative overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-white via-indigo-50/70 to-slate-50 p-6 shadow-sm sm:p-9">
        <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-20 h-64 w-64 rounded-full bg-indigo-200/30 blur-3xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/80 px-3 py-1 text-[11px] font-bold tracking-wide text-indigo-700 uppercase">Timed math · server checked</span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">My proofs</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">Request a fresh math problem during an eligible challenge’s proof window. Local QVAC reviews the submitted answer; the server independently checks it against the problem and records the result.</p>
        </div>
      </section>

      {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p> : null}
      {notice ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p> : null}

      {!ready ? (
        <p role="status" className="text-sm text-slate-500">Loading your participant session…</p>
      ) : !token ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Connect your participant</h2>
          <p className="mt-2 text-sm text-slate-600">Restore or create a Goal Digger participant to read proofs for your challenges.</p>
          <Link to="/profile" className="mt-4 inline-flex rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-700">Open profile</Link>
        </section>
      ) : challenges.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">No timed-math challenges</h2>
          <p className="mt-2 text-sm text-slate-600">This proof screen currently supports challenges that use the server-checked timed-math method.</p>
          <Link to="/challenges" className="mt-4 inline-flex font-bold text-indigo-600 hover:text-indigo-800">Browse challenges →</Link>
        </section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {challenges.map((challenge) => {
            const history = proofs[challenge.id];
            const problem = problems[challenge.id];
            const eligible = ["open", "betting_closed"].includes(challenge.status)
              && now >= Date.parse(challenge.startsAt)
              && now < Date.parse(challenge.proofDeadline)
              && !history?.accepted;
            return (
              <article key={challenge.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">{challenge.statusLabel} · {challenge.templateEmoji} {challenge.template}</p>
                    <h2 className="mt-1 text-lg font-extrabold text-slate-900">{challenge.title}</h2>
                    <p className="mt-1 text-xs text-slate-500">Proof window ends {formatDate(challenge.proofDeadline)} UTC</p>
                  </div>
                  <Link to={`/challenges/${challenge.id}`} className="text-sm font-bold text-indigo-600 hover:text-indigo-800">View challenge</Link>
                </div>

                {history?.proofs.length ? (
                  <ol className="mt-5 space-y-2">
                    {history.proofs.map((proof) => (
                      <li key={proof.problemId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <span className="text-sm font-bold text-slate-800">Answer: {proof.answer}</span>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${proof.status === "accepted" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>{proof.status}</span>
                        {proof.agentReview ? <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-800">Local QVAC {proof.agentReview.verdict}</span> : null}
                        <span className="w-full text-xs text-slate-500">{formatDate(proof.submittedAt)} · {proof.reason}</span>
                        {proof.agentReview ? <span className="w-full text-xs text-slate-500">Agent review: {proof.agentReview.reason}</span> : null}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-5 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">No answer has been submitted for this challenge.</p>
                )}

                {problem ? (
                  <form className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4" onSubmit={(event) => { event.preventDefault(); void submitAnswer(challenge); }}>
                    <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">Your live problem</p>
                    <p className="mt-2 font-mono text-2xl font-extrabold text-slate-900">{problem.left} {problem.operator} {problem.right} = ?</p>
                    <p className="mt-1 text-xs text-slate-500">Submit before {formatDate(problem.expiresAt)} UTC.</p>
                    <label className="mt-4 block text-sm font-semibold text-slate-800">Answer
                      <input inputMode="numeric" pattern="-?\d{1,6}" value={answers[challenge.id] ?? ""} onChange={(event) => setAnswers((current) => ({ ...current, [challenge.id]: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-mono text-lg" required />
                    </label>
                    <button type="submit" disabled={busyId === challenge.id || !/^-?\d{1,6}$/.test(answers[challenge.id] ?? "")} className="mt-3 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busyId === challenge.id ? "Checking answer…" : "Submit answer"}</button>
                  </form>
                ) : eligible ? (
                  <button type="button" disabled={busyId === challenge.id} onClick={() => void startProblem(challenge)} className="mt-5 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busyId === challenge.id ? "Preparing problem…" : history?.proofs.length ? "Request another problem" : "Start proof check"}</button>
                ) : history?.accepted ? (
                  <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">The local agent reviewed and the server verified a proof for this challenge.</p>
                ) : (
                  <p className="mt-5 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">The proof window is not open. It runs from {formatDate(challenge.startsAt)} to {formatDate(challenge.proofDeadline)} UTC.</p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
