import { useEffect, useState } from "react";
import { Link } from "react-router";

import type { Route } from "./+types/profile";
import { ChallengeCard } from "~/components/challenges/challenge-card";
import {
  BoardError,
  boardSession,
  createBoardClient,
  type BoardChallenge,
} from "~/lib/board";
import {
  CHALLENGE_CREATION_ENABLED,
  DOWNLOAD_INSTRUCTIONS_HINT,
} from "~/lib/feature-flags";

const client = createBoardClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? "/api",
});

export function meta({}: Route.MetaArgs) {
  return [{ title: "Profile · Goal Digger" }];
}

export default function Profile() {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState("");
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [participant, setParticipant] = useState("");
  const [challenges, setChallenges] = useState<BoardChallenge[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
        setParticipantId(result.participant.id);
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
        if (active) setChallenges(result);
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
    try {
      const result = restore
        ? { ...(await client.me(key.trim())), token: key.trim() }
        : await client.createSession(name.trim());
      boardSession(localStorage).save(result.token);
      setToken(result.token);
      setParticipantId(result.participant.id);
      setParticipant(result.participant.displayName);
      setKey("");
      setName("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The request failed.");
    } finally {
      setBusy(false);
    }
  }

  const mine = challenges.filter((challenge) => challenge.creatorId === participantId);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 lg:px-8">
      {!token ? (
        <div className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-white via-indigo-50/60 to-slate-50 p-7 shadow-sm sm:p-9">
          <span className="text-xs font-bold tracking-wide text-indigo-600 uppercase">Your Goal Digger account</span>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Profile</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Restore your participant to view the challenges linked to your account. Your wallet stays separate from this profile.
          </p>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
          {error}
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
            <label htmlFor="profile-key" className="mt-4 block text-sm font-semibold">
              Participant access key
            </label>
            <input
              id="profile-key"
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
            <h2 className="text-lg font-bold text-slate-900">New participant</h2>
            <label htmlFor="profile-name" className="mt-4 block text-sm font-semibold">
              Your display name
            </label>
            <input
              id="profile-name"
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
      ) : (
        <section className="flex flex-col gap-4">
          <div className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-white via-indigo-50/60 to-slate-50 p-6 shadow-sm sm:p-8">
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
              <div className="flex min-w-0 items-center gap-4">
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-indigo-600 text-2xl font-extrabold text-white shadow-sm">
                  {participant.trim().slice(0, 1).toUpperCase() || "G"}
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold tracking-wide text-indigo-600 uppercase">Participant profile</span>
                  <h1 className="mt-1 truncate text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{participant}</h1>
                  <p className="mt-1 truncate font-mono text-xs text-slate-500">ID {participantId.slice(0, 8)}…{participantId.slice(-6)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to="/wallet" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700">Open wallet</Link>
                {CHALLENGE_CREATION_ENABLED ? (
                  <Link to="/challenges/new" className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700">Create challenge</Link>
                ) : (
                  <button
                    type="button"
                    disabled
                    title={DOWNLOAD_INSTRUCTIONS_HINT}
                    className="cursor-not-allowed rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-bold text-slate-500"
                  >
                    Create challenge
                  </button>
                )}
              </div>
            </div>
            <div className="mt-6 grid gap-3 border-t border-indigo-100 pt-5 sm:grid-cols-2">
              <div className="rounded-2xl border border-white bg-white/80 p-4">
                <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">Created challenges</p>
                <p className="mt-1 text-2xl font-extrabold text-slate-900">{mine.length}</p>
              </div>
              <div className="rounded-2xl border border-white bg-white/80 p-4">
                <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">Account status</p>
                <p className="mt-1 flex items-center gap-2 text-sm font-bold text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500" />Connected</p>
              </div>
            </div>
          </div>
          {busy ? (
            <p role="status" className="text-sm text-slate-500">
              Read challenges…
            </p>
          ) : null}
          {!busy && mine.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
              {CHALLENGE_CREATION_ENABLED ? (
                <>
                  You have no challenges yet.{" "}
                  <Link to="/challenges/new" className="font-semibold text-indigo-600">
                    Create a challenge
                  </Link>
                  .
                </>
              ) : (
                <>You have no challenges yet. Creating one is disabled in this build.</>
              )}
            </p>
          ) : null}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {mine.map((challenge) => (
              <ChallengeCard key={challenge.id} challenge={challenge} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
