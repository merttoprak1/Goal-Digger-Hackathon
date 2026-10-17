import { useEffect, useState } from "react";
import { Link } from "react-router";

import type { Route } from "./+types/challenges";
import {
  BoardError,
  boardSession,
  createBoardClient,
  type BoardChallenge,
} from "~/lib/board";
import { ArbiterPanel } from "~/components/challenges/arbiter-panel";
import { ChallengeCard } from "~/components/challenges/challenge-card";


const client = createBoardClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? "/api",
});

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Challenges · Goal Digger" },
    {
      name: "description",
      content: "Read your drafts and published challenges from the live API.",
    },
  ];
}

export default function Challenges() {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [participant, setParticipant] = useState("");
  const [challenges, setChallenges] = useState<BoardChallenge[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    let active = true;
    const saved = boardSession(localStorage).read();
    if (!saved) {
      setReady(true);
      return;
    }
    client
      .me(saved)
      .then((result) => {
        if (!active) return;
        setToken(saved);
        setParticipant(result.participant.displayName);
      })
      .catch((cause) => {
        if (!active) return;
        if (cause instanceof BoardError && cause.status === 401) {
          boardSession(localStorage).clear();
        }
        setError(cause instanceof Error ? cause.message : "The request failed.");
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    let active = true;
    setBusy(true);
    client
      .list(token)
      .then((result) => {
        if (active) {
          setChallenges(result);
          setError("");
        }
      })
      .catch((cause) => {
        if (!active) return;
        if (cause instanceof BoardError && cause.status === 401) {
          boardSession(localStorage).clear();
          setToken(null);
          setParticipant("");
        }
        setError(cause instanceof Error ? cause.message : "The request failed.");
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function connect(restore: boolean) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNote("");
    try {
      const result = restore
        ? { ...(await client.me(key.trim())), token: key.trim() }
        : await client.createSession(name.trim());
      if (!boardSession(localStorage).save(result.token)) {
        setNote("The session could not be saved. Keep this page open.");
      }
      setToken(result.token);
      setParticipant(result.participant.displayName);
      setKey("");
      setName("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The request failed.");
    } finally {
      setBusy(false);
    }
  }

  function disconnect() {
    boardSession(localStorage).clear();
    setToken(null);
    setParticipant("");
    setChallenges([]);
    setError("");
    setNote("");
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-8 lg:px-8">
      <div className="flex flex-col items-center justify-center gap-2 border-b border-slate-200 pb-6 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Challenges
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-center text-sm leading-relaxed font-normal text-slate-500 sm:text-base">
          Your drafts and every published challenge come from the live API.
          Opening this page does not move funds.
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      {note ? (
        <p role="status" className="text-sm text-slate-600">
          {note}
        </p>
      ) : null}

      {!ready ? (
        <p role="status" className="text-sm text-slate-500">
          Restore participant session…
        </p>
      ) : !token ? (
        <section className="grid gap-6 md:grid-cols-2">
          <form
            className="rounded-2xl border border-slate-200 bg-white p-6"
            onSubmit={(event) => {
              event.preventDefault();
              connect(true);
            }}
          >
            <h2 className="text-lg font-bold text-slate-900">
              Restore your participant
            </h2>
            <p className="my-3 text-sm text-slate-600">
              Use the same access key as Payouts. A new name does not recover
              previous challenges.
            </p>
            <label htmlFor="participant-key" className="text-sm font-semibold">
              Participant access key
            </label>
            <input
              id="participant-key"
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={key}
              onChange={(event) => setKey(event.target.value)}
              pattern="[a-f0-9]{64}"
              required
            />
            <button
              className="mt-4 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
              disabled={busy}
            >
              Restore participant
            </button>
          </form>
          <form
            className="rounded-2xl border border-slate-200 bg-white p-6"
            onSubmit={(event) => {
              event.preventDefault();
              connect(false);
            }}
          >
            <h2 className="text-lg font-bold text-slate-900">
              New participant
            </h2>
            <p className="my-3 text-sm text-slate-600">
              Create the identity that will own your drafts. This does not
              move funds.
            </p>
            <label htmlFor="participant-name" className="text-sm font-semibold">
              Your display name
            </label>
            <input
              id="participant-name"
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm"
              maxLength={60}
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
            <button
              className="mt-4 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
              disabled={busy || !name.trim()}
            >
              Create participant
            </button>
          </form>
        </section>
      ) : null}

      {token ? (
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-7">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold">
              <button
                type="button"
                className="rounded-xl border border-indigo-600 bg-indigo-600 px-3.5 py-2 text-white shadow-sm transition hover:bg-indigo-700"
              >
                All Goals ({challenges.length})
              </button>
            </div>
            <span className="font-mono text-xs font-medium text-slate-400">
              Newest first
            </span>
          </div>

          <p className="text-sm text-slate-600">
            Signed in as <strong>{participant}</strong>.{" "}
            <button
              type="button"
              className="font-semibold text-indigo-600"
              onClick={disconnect}
            >
              Disconnect
            </button>
          </p>
          {busy ? (
            <p role="status" className="text-sm text-slate-500">
              Read challenges…
            </p>
          ) : null}
          {!busy && challenges.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
              No drafts or published challenges yet.
            </p>
          ) : null}
          {challenges.length === 100 ? (
            <p className="text-xs text-slate-500">
              Showing the newest 100 challenges.
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {challenges.map((challenge) => (
              <ChallengeCard key={challenge.id} challenge={challenge} />
            ))}
          </div>

          <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white shadow-sm">
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-600/30 text-lg text-indigo-300">
                ⚡
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">
                  Ready to save a draft?
                </h4>
                <p className="text-xs font-normal text-slate-300">
                  A custom draft is saved for this participant. No funds move.
                </p>
              </div>
            </div>
            <Link
              to="/challenges/new"
              className="shrink-0 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-500"
            >
              + Custom Challenge
            </Link>
          </div>
        </div>

        <ArbiterPanel />
      </div>
      ) : null}
    </main>
  );
}
