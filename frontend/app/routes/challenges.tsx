import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import type { Route } from "./+types/challenges";
import { askGoaly } from "~/lib/goaly";
import { ARBITER } from "~/lib/mock-store";
import {
  BoardError,
  boardSession,
  createBoardClient,
  type BoardChallenge,
} from "~/lib/board";
import type { ArbiterProfile } from "~/lib/contracts";

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

/* ------------------------------ presentation ----------------------------- */

const PRESETS = [
  {
    label: "⏰ Wake up at 6:30am (5 USDT)",
    goal: "Wake up at 6:30 AM tomorrow with SleepCycle verification",
    stake: "5",
  },
  {
    label: "📚 Study 4 hours (10 USDT)",
    goal: "Deep focus study session for 4 straight hours without distraction",
    stake: "10",
  },
  {
    label: "💪 Complete 50 pushups (video proof)",
    goal: "Complete 50 continuous pushups verified with video upload timestamp",
    stake: "15",
  },
];

/* ------------------------------- components ------------------------------ */

function ChallengeCard({ challenge }: { challenge: BoardChallenge }) {
  return (
    <article
      className={`group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md ${challenge.hover}`}
    >
      <div>
        <div className="mb-3.5 flex items-center justify-between">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase ${challenge.badge}`}
          >
            {challenge.statusLabel}
          </span>
          <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
            {challenge.template} {challenge.templateEmoji}
          </span>
        </div>

        <Link to={`/challenges/${challenge.id}`} className="block">
          <h3
            className={`text-base leading-snug font-bold text-slate-900 transition-colors ${challenge.titleHover}`}
          >
            {challenge.title}
          </h3>
        </Link>
        <p className="mt-1 mb-5 text-xs font-medium text-slate-400">
          by{" "}
          <span className="font-semibold text-slate-700">
            {challenge.creator}
          </span>
        </p>
      </div>

      <div className="border-t border-slate-100 pt-3">
        <div className="mb-3 flex items-center justify-between text-xs">
          <span className="font-medium text-slate-500">
            Stake{" "}
            <strong className="ml-1 font-mono text-sm font-bold text-slate-900">
              {challenge.stakeUsdt} USDT
            </strong>
          </span>
          {challenge.poolUsdt ? (
            <span className="font-medium text-slate-500">
              Eligible{" "}
              <span
                className={`ml-1 font-mono text-sm font-bold ${challenge.poolTone}`}
              >
                {challenge.poolUsdt} USDT
              </span>
            </span>
          ) : (
            <span className="font-mono text-xs font-medium text-slate-400">
              Eligible — USDT
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-slate-50 p-2.5 text-xs text-slate-600">
          <span className="truncate text-[11px] font-medium text-slate-500">
            {challenge.proofSource}
          </span>
          <span className="shrink-0 text-[11px] font-semibold text-indigo-600">
            {challenge.note}
          </span>
        </div>
      </div>
    </article>
  );
}

type ChatMessage = {
  id: number;
  from: "goaly" | "user";
  text: string;
};

function GoalyBubble({ text }: { text: string }) {
  return (
    <div className="chat-bubble-tail-left rounded-2xl border border-slate-200/90 bg-slate-50 p-3.5 shadow-sm transition-all duration-200">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-indigo-700">Goaly</span>
          <span className="rounded-full bg-indigo-100/70 px-1.5 py-0.5 text-[9px] font-bold text-indigo-600">
            AI ARBITER
          </span>
        </div>
        <span className="font-mono text-[10px] text-slate-400">Just now</span>
      </div>
      <p className="text-xs leading-relaxed font-medium text-slate-700">
        &ldquo;{text}&rdquo;
      </p>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="max-w-[90%] self-end rounded-2xl rounded-br-sm bg-indigo-600 p-3 text-xs text-white shadow-sm transition-all duration-200">
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="text-[10px] font-bold tracking-wide text-indigo-200 uppercase">
          You (Challenger)
        </span>
        <span className="font-mono text-[9px] text-indigo-200">Sent</span>
      </div>
      <p className="leading-relaxed font-medium">{text}</p>
    </div>
  );
}

function TypingIndicator({
  working,
  idleText,
}: {
  working: boolean;
  idleText: string;
}) {
  return (
    <div className="flex items-center gap-2 pl-2 text-[11px] font-medium text-slate-400">
      <div
        className={`flex items-center gap-1 rounded-full px-2 py-1 ${
          working ? "border border-indigo-100 bg-indigo-50" : "bg-slate-100"
        }`}
      >
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-600" />
        <span
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-600"
          style={{ animationDelay: "150ms" }}
        />
        <span
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-600"
          style={{ animationDelay: "300ms" }}
        />
      </div>
      <span className={working ? "font-semibold text-indigo-600" : undefined}>
        {working ? "Goaly is preparing a reply..." : idleText}
      </span>
    </div>
  );
}

function ArbiterPanel({ arbiter }: { arbiter: ArbiterProfile }) {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    arbiter.greeting.map((text, index) => ({
      id: index,
      from: "goaly" as const,
      text,
    })),
  );
  const [draft, setDraft] = useState("");
  const [stake, setStake] = useState("10");
  const [working, setWorking] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nextId = useRef(arbiter.greeting.length);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((id) => window.clearTimeout(id));
  }, []);

  function schedule(callback: () => void, ms: number) {
    timers.current.push(window.setTimeout(callback, ms));
  }

  function say(text: string) {
    setMessages((current) => [
      ...current,
      { id: nextId.current++, from: "goaly", text },
    ]);
  }

  function speak(ms = 5000) {
    setSpeaking(true);
    schedule(() => setSpeaking(false), ms);
  }

  function applyPreset(preset: (typeof PRESETS)[number]) {
    setDraft(preset.goal);
    setStake(preset.stake);
    inputRef.current?.focus();
    speak(3000);
  }

  async function propose() {
    const goal = draft.trim();
    if (!goal || working) return;

    setMessages((current) => [
      ...current,
      { id: nextId.current++, from: "user", text: `${goal} (Stake: ${stake} USDT)` },
    ]);
    setDraft("");
    setWorking(true);
    speak();

    try { say(await askGoaly(goal)); }
    catch(e) { say(e instanceof Error ? e.message : 'Goaly is unavailable. Try again.'); }
    finally { setWorking(false);setSpeaking(false); }
  }

  return (
    <aside className="relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm lg:col-span-5">
      <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-indigo-50/60 blur-3xl" />

      <div className="relative z-10 flex items-center justify-between border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-2 text-sm font-bold tracking-tight text-slate-900">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            {arbiter.name} • {arbiter.role}
          </span>
          <span className="rounded-md border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
            {arbiter.agent}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold">
          <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-slate-700">
            {arbiter.level}
          </span>
          <span className="rounded-md border border-violet-100 bg-violet-50 px-2 py-0.5 text-violet-700">
            {arbiter.accuracy}
          </span>
        </div>
      </div>

      <div className="relative z-10 my-4 flex flex-col gap-3">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <button
            type="button"
            onClick={() => {
              say("Hey! Stop poking the Arbiter and go finish your challenges!");
              speak();
            }}
            title="Click to interact with Goaly!"
            className="group flex shrink-0 cursor-pointer flex-col items-center"
          >
            <div className="mascot-alive relative flex h-48 w-36 items-end justify-center transition-transform duration-300 group-hover:scale-105 sm:h-52 sm:w-40">
              <img
                src="/goaly.png"
                alt="Goaly, the Goal Digger panda arbiter"
                className={`pointer-events-none h-full w-full object-contain select-none mix-blend-multiply ${
                  speaking ? "mascot-talking" : ""
                }`}
              />
              <span
                className="absolute right-1 bottom-6 z-30 h-4 w-4 rounded-full border-2 border-white bg-emerald-500 shadow-sm"
                title="Active Arbiter Online"
              />
            </div>
            <span className="-mt-2 flex items-center gap-1.5 text-xs font-extrabold text-slate-800">
              Goaly
              <span className="rounded border border-indigo-100 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-indigo-600 uppercase">
                Judge
              </span>
            </span>
          </button>

          <div className="flex w-full flex-1 flex-col gap-2.5 pt-2">
            {messages.map((message) =>
              message.from === "goaly" ? (
                <GoalyBubble key={message.id} text={message.text} />
              ) : (
                <UserBubble key={message.id} text={message.text} />
              ),
            )}
          </div>
        </div>

        <TypingIndicator working={working} idleText={arbiter.statusText} />

        <div className="mt-1">
          <span className="mb-2 block text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            Preset Challenge Templates:
          </span>
          <div className="flex flex-wrap gap-2 text-xs">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-left font-semibold text-slate-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-auto flex flex-col gap-2.5 border-t border-slate-100 pt-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
          <label htmlFor="goal-input" className="flex items-center gap-1.5">
            <span>Propose Contract to Arbiter</span>
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
          </label>
          <span className="text-[11px] font-semibold text-indigo-600">
            Oracle settlement
          </span>
        </div>

        <div className="relative rounded-2xl border border-slate-200 bg-slate-50 p-2.5 shadow-sm transition focus-within:border-indigo-500 focus-within:bg-white">
          <textarea
            id="goal-input"
            ref={inputRef}
            rows={2}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                propose();
              }
            }}
            placeholder="e.g., Code for 2 hours tonight, 20 USDT stake, verify with GitHub commit..."
            className="w-full resize-none border-0 bg-transparent p-0 text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
          />
          <div className="mt-1 flex items-center justify-between border-t border-slate-200/60 pt-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200/90 bg-white px-2.5 py-1">
              <span className="text-[11px] font-medium text-slate-500">
                Stake:
              </span>
              <input
                type="number"
                min={1}
                value={stake}
                onChange={(event) => setStake(event.target.value)}
                className="w-12 border-0 bg-transparent p-0 text-right font-mono text-xs font-bold text-indigo-600 focus:outline-none"
              />
              <span className="font-mono text-[10px] font-bold text-slate-400">
                USDT
              </span>
            </div>
            <button
              type="button"
              onClick={propose}
              disabled={working}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-95"
            >
              <span>Propose</span>
              <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </div>

        <p className="mt-0.5 text-center text-[11px] font-medium text-slate-400">
          Goal Digger controls the WDK vault. Challenge payments are not connected here yet.
        </p>
      </div>
    </aside>
  );
}

/* --------------------------------- screen -------------------------------- */

export default function Challenges() {
  const arbiter = ARBITER;
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
        <div className="flex items-center justify-center gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Challenges
          </h1>
          <span className="rounded-full border border-indigo-200/80 bg-indigo-50 px-2.5 py-1 text-xs font-bold tracking-wider text-indigo-700 uppercase">
            v2.4 Live
          </span>
        </div>
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

        <ArbiterPanel arbiter={arbiter} />
      </div>
      ) : null}
    </main>
  );
}
