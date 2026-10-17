import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { AnimatePresence, motion } from "motion/react";

import type { Route } from "./+types/challenges";
import { MessageIn, StatusLabel, TypingDots } from "~/components/chat";
import { Icon } from "~/components/icon";
import { fetchChallengesSnapshot } from "~/lib/api";
import { EASE } from "~/lib/motion";
import { POOL_TONE, proofHint, STATUS_BADGE } from "~/lib/challenge-view";
import type {
  ArbiterProfile,
  Challenge,
  ChallengeStatus,
  ChallengesSnapshot,
} from "~/lib/contracts";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Challenges · Goal Digger" },
    {
      name: "description",
      content:
        "Transparent proof criteria, cryptographic timelocks, and real-time validation supervised by autonomous AI arbiters.",
    },
  ];
}

export async function clientLoader() {
  return fetchChallengesSnapshot();
}

/* ------------------------------ presentation ----------------------------- */

const CARD_HOVER: Record<ChallengeStatus, string> = {
  active: "hover:border-indigo-400",
  draft: "hover:border-slate-300",
  open: "hover:border-indigo-400",
  new: "hover:border-indigo-400",
  settled: "hover:border-emerald-300",
};

const TITLE_HOVER: Record<ChallengeStatus, string> = {
  active: "group-hover:text-indigo-600",
  draft: "group-hover:text-indigo-600",
  open: "group-hover:text-indigo-600",
  new: "group-hover:text-indigo-600",
  settled: "group-hover:text-emerald-600",
};

/**
 * Board filters. "All Challenges" shows everything; the other three read the
 * viewer relation the API attaches to each pool.
 */
type BoardFilter = "all" | "staked" | "won" | "created";

const BOARD_FILTERS: Array<{ id: BoardFilter; label: string }> = [
  { id: "all", label: "All Challenges" },
  { id: "staked", label: "Active Stakes" },
  { id: "won", label: "Settled Won" },
  { id: "created", label: "Created Pools" },
];

/** A settled pool is no longer an active stake, so it drops out of that view. */
function inBoard(challenge: Challenge, filter: BoardFilter): boolean {
  if (filter === "all") return true;
  const viewer = challenge.viewer;
  if (!viewer) return false;
  if (filter === "staked") return viewer.staked && challenge.status !== "settled";
  if (filter === "won") return viewer.won;
  return viewer.created;
}

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

function ChallengeCard({
  challenge,
  onAction,
  index,
}: {
  challenge: Challenge;
  onAction: (challenge: Challenge) => void;
  index: number;
}) {
  const { status, action } = challenge;

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: index * 0.06, ease: EASE }}
      whileHover={{ y: -3 }}
      className={`group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md ${CARD_HOVER[status]}`}
    >
      <div>
        <div className="mb-3.5 flex items-center justify-between">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase ${STATUS_BADGE[status]}`}
          >
            {status}
          </span>
          <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
            {challenge.template} {challenge.templateEmoji}
          </span>
        </div>

        <Link to={`/challenges/${challenge.id}`} className="block">
          <h3
            className={`text-base leading-snug font-bold text-slate-900 transition-colors ${TITLE_HOVER[status]}`}
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
              Pool{" "}
              <span
                className={`ml-1 font-mono text-sm font-bold ${POOL_TONE[status]}`}
              >
                {challenge.poolUsdt} USDT
              </span>
            </span>
          ) : (
            <span className="font-mono text-xs font-medium text-slate-400">
              Pool — USDT
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-slate-50 p-2.5 text-xs text-slate-600">
          {action.kind === "button" ? (
            <>
              <span className="truncate text-[11px] font-medium text-slate-500">
                {challenge.proofSource}
              </span>
              <button
                type="button"
                onClick={() => onAction(challenge)}
                className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition hover:bg-indigo-700"
              >
                {action.label}
              </button>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600">
                {action.label}
              </span>
              <span className="text-[10px] font-medium text-slate-400">
                {action.note}
              </span>
            </>
          )}
        </div>
      </div>
    </motion.article>
  );
}

type ChatMessage = {
  id: number;
  from: "goaly" | "user";
  text: string;
};

function GoalyBubble({ text }: { text: string }) {
  return (
    <MessageIn className="chat-bubble-tail-left rounded-2xl border border-slate-200/90 bg-slate-50 p-3.5 shadow-sm">
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
    </MessageIn>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <MessageIn className="max-w-[90%] self-end rounded-2xl rounded-br-sm bg-indigo-600 p-3 text-xs text-white shadow-sm">
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="text-[10px] font-bold tracking-wide text-indigo-200 uppercase">
          You (Challenger)
        </span>
        <span className="font-mono text-[9px] text-indigo-200">Sent</span>
      </div>
      <p className="leading-relaxed font-medium">{text}</p>
    </MessageIn>
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
      <TypingDots active={working} />
      <StatusLabel working={working} idleText={idleText} />
    </div>
  );
}

/** A card button asked the arbiter form to pre-fill. `nonce` allows repeats. */
type PrefillRequest = { challenge: Challenge; nonce: number };

function GoalyChat({
  arbiter,
  prefill,
  open,
  onToggle,
}: {
  arbiter: ArbiterProfile;
  prefill: PrefillRequest | null;
  open: boolean;
  onToggle: () => void;
}) {
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
  const [flash, setFlash] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nextId = useRef(arbiter.greeting.length);
  const timers = useRef<number[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((id) => window.clearTimeout(id));
  }, []);

  // Escape closes the panel, the way a dialog should.
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onToggle();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onToggle]);

  // Follow the newest line only while the reader is already at the bottom, so
  // scrolling back up to re-read the contract is not interrupted.
  useEffect(() => {
    const feed = feedRef.current;
    if (feed && stickToBottom.current) feed.scrollTop = feed.scrollHeight;
  }, [messages]);

  // The feed element is created fresh on every open, so land on the newest line
  // and re-arm the follow — otherwise the reader opens onto the oldest greeting
  // of a conversation that is already taller than the box.
  useEffect(() => {
    if (!open) return;
    const feed = feedRef.current;
    if (!feed) return;
    stickToBottom.current = true;
    feed.scrollTop = feed.scrollHeight;
  }, [open]);

  function pinIfAtBottom() {
    const feed = feedRef.current;
    if (!feed) return;
    stickToBottom.current =
      feed.scrollHeight - feed.scrollTop - feed.clientHeight < 40;
  }

  function schedule(callback: () => void, ms: number) {
    timers.current.push(window.setTimeout(callback, ms));
  }

  function say(text: string) {
    pinIfAtBottom();
    setMessages((current) => [
      ...current,
      { id: nextId.current++, from: "goaly", text },
    ]);
  }

  function speak(ms = 5000) {
    setSpeaking(true);
    schedule(() => setSpeaking(false), ms);
  }

  /**
   * Card buttons pre-fill the proposal form, same as the preset chips — except
   * here the values arrive from somewhere else on the page, so the panel flashes
   * to show where they came from.
   */
  useEffect(() => {
    if (!prefill) return;
    const { challenge } = prefill;
    setDraft(
      `Counter-stake on "${challenge.title}" by ${challenge.creator} — ${challenge.stakeUsdt} USDT, verify with ${proofHint(challenge)}`,
    );
    setStake(challenge.stakeUsdt);
    inputRef.current?.focus();

    setFlash(true);
    const timer = window.setTimeout(() => setFlash(false), 1100);
    return () => window.clearTimeout(timer);
  }, [prefill]);

  function applyPreset(preset: (typeof PRESETS)[number]) {
    setDraft(preset.goal);
    setStake(preset.stake);
    inputRef.current?.focus();
    speak(3000);
  }

  function propose() {
    const goal = draft.trim();
    if (!goal) return;

    pinIfAtBottom();
    setMessages((current) => [
      ...current,
      { id: nextId.current++, from: "user", text: `${goal} (Stake: ${stake} USDT)` },
    ]);
    setDraft("");
    setWorking(true);
    speak();

    schedule(() => {
      const quote =
        arbiter.replyQuotes[
          Math.floor(Math.random() * arbiter.replyQuotes.length)
        ];
      say(quote);
      setWorking(false);
    }, 750);
  }

  return (
    <>
      {/* Launcher: the arbiter is a corner widget now, so the board keeps the
          full width until someone actually asks it something. */}
      <AnimatePresence>
        {open ? null : (
          <motion.button
            key="goaly-launcher"
            type="button"
            onClick={onToggle}
            aria-expanded={false}
            aria-label={`Ask ${arbiter.name}, the AI arbiter`}
            initial={{ opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.9 }}
            transition={{ duration: 0.22, ease: EASE }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.96 }}
            className="fixed right-4 bottom-4 z-40 flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 pr-4 pl-1.5 shadow-xl shadow-slate-900/10 transition-colors hover:border-indigo-300 sm:right-6 sm:bottom-6"
          >
            <span className="relative flex h-11 w-11 shrink-0 items-end justify-center">
              <img
                src="/goaly.png"
                alt=""
                className="mascot-alive pointer-events-none h-11 w-11 object-contain select-none mix-blend-multiply"
              />
              <span className="absolute right-0 bottom-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
            </span>
            <span className="flex flex-col items-start leading-tight">
              <span className="text-xs font-extrabold text-slate-900">
                Ask {arbiter.name}
              </span>
              <span className="text-[10px] font-semibold text-slate-400">
                {arbiter.agent} · online
              </span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open ? (
          <motion.aside
            key="goaly-panel"
            role="dialog"
            aria-label={`${arbiter.name} arbiter chat`}
            initial={{ opacity: 0, y: 28, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 28, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            style={{ transformOrigin: "bottom right" }}
            className="fixed inset-x-4 bottom-4 z-40 flex h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-900/25 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:h-[min(74vh,600px)] sm:w-[390px]"
          >
            <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-indigo-50/60 blur-3xl" />

            {/* Ring that fades out where the card handed its values over. */}
            {flash ? (
              <motion.span
                key={prefill?.nonce}
                aria-hidden="true"
                initial={{ opacity: 0.8 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 1.1, ease: "easeOut" }}
                className="pointer-events-none absolute inset-0 z-20 rounded-3xl ring-2 ring-indigo-500 ring-inset"
              />
            ) : null}

            <div className="relative z-10 flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.9, rotate: -3 }}
                  onClick={() => {
                    say(
                      "Hey! Stop poking the Arbiter and go finish your challenges!",
                    );
                    speak();
                  }}
                  title="Click to interact with Goaly!"
                  className="flex h-10 w-10 shrink-0 cursor-pointer items-end justify-center"
                >
                  <img
                    src="/goaly.png"
                    alt="Goaly, the Goal Digger panda arbiter"
                    className={`pointer-events-none h-10 w-10 object-contain select-none mix-blend-multiply ${
                      speaking ? "mascot-talking" : ""
                    }`}
                  />
                </motion.button>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-bold tracking-tight text-slate-900">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                    {arbiter.name} • {arbiter.role}
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] font-semibold text-slate-400">
                    {arbiter.agent}
                  </span>
                </span>
              </div>
              <button
                type="button"
                onClick={onToggle}
                aria-label="Close the arbiter chat"
                className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <Icon name="close" className="text-[18px]" />
              </button>
            </div>

            <div
              ref={feedRef}
              className="chat-feed relative z-10 flex flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain px-4 pt-3 pb-1"
            >
              {messages.map((message) =>
                message.from === "goaly" ? (
                  <GoalyBubble key={message.id} text={message.text} />
                ) : (
                  <UserBubble key={message.id} text={message.text} />
                ),
              )}
            </div>

            <div className="relative z-10 px-4 pb-1">
              <TypingIndicator working={working} idleText={arbiter.statusText} />
            </div>

            <div className="relative z-10 flex gap-1.5 overflow-x-auto border-t border-slate-100 px-4 py-2.5">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="shrink-0 cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold whitespace-nowrap text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="relative z-10 border-t border-slate-100 px-4 pt-2.5 pb-3">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                <label htmlFor="goal-input" className="flex items-center gap-1.5">
                  <span>Propose Contract</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                </label>
                {/* Keyed swap rather than AnimatePresence: a transient badge
                    must not wait for an exit animation before it can appear. */}
                <motion.span
                  key={flash ? "prefilled" : "settlement"}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: EASE }}
                  className={
                    flash
                      ? "rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold tracking-wide text-indigo-700 uppercase"
                      : "text-[11px] font-semibold text-indigo-600"
                  }
                >
                  {flash ? "Prefilled from card" : "Arbiter settlement"}
                </motion.span>
              </div>

              <div
                className={[
                  "relative mt-2 rounded-2xl border p-2.5 shadow-sm transition-colors duration-500 focus-within:border-indigo-500 focus-within:bg-white",
                  flash
                    ? "border-indigo-400 bg-indigo-50/60"
                    : "border-slate-200 bg-slate-50",
                ].join(" ")}
              >
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
                  <div
                    className={[
                      "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 transition-colors duration-500",
                      flash
                        ? "border-indigo-400 bg-indigo-50"
                        : "border-slate-200/90 bg-white",
                    ].join(" ")}
                  >
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
                    className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-95"
                  >
                    <span>Propose</span>
                    <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  </button>
                </div>
              </div>

              <p className="mt-2 text-center text-[10px] font-medium text-slate-400">
                Enforced cryptographically using discrete log contracts (DLCs) on
                Bitcoin.
              </p>
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </>
  );
}

/* --------------------------------- screen -------------------------------- */

export default function Challenges({ loaderData }: Route.ComponentProps) {
  const { challenges, arbiter } = loaderData as ChallengesSnapshot;
  const [prefill, setPrefill] = useState<PrefillRequest | null>(null);
  const [board, setBoard] = useState<BoardFilter>("all");
  const [chatOpen, setChatOpen] = useState(false);
  const nonce = useRef(0);

  const visible = challenges.filter((challenge) => inBoard(challenge, board));
  const toggleChat = useCallback(() => setChatOpen((value) => !value), []);

  function handleAction(challenge: Challenge) {
    nonce.current += 1;
    setPrefill({ challenge, nonce: nonce.current });
    // The prefill lands in the chat, so open it rather than whisper into a
    // closed panel.
    setChatOpen(true);
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
          Transparent proof criteria, cryptographic timelocks, and real-time
          validation supervised by autonomous AI arbiters.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {BOARD_FILTERS.map((item) => {
              const isActive = board === item.id;
              const count = challenges.filter((challenge) =>
                inBoard(challenge, item.id),
              ).length;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setBoard(item.id)}
                  className={[
                    "relative flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold whitespace-nowrap transition-colors",
                    isActive
                      ? "text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-700",
                  ].join(" ")}
                >
                  {isActive ? (
                    <motion.span
                      layoutId="board-filter"
                      transition={{
                        type: "spring",
                        stiffness: 480,
                        damping: 34,
                      }}
                      className="absolute inset-0 rounded-xl bg-indigo-600 shadow-sm"
                    />
                  ) : null}
                  <span className="relative z-10">{item.label}</span>
                  <span
                    className={[
                      "relative z-10 font-mono",
                      isActive ? "text-indigo-100" : "text-slate-400",
                    ].join(" ")}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          <span className="font-mono text-xs font-medium text-slate-400">
            Sorted by: Deadline
          </span>
        </div>

        {visible.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((challenge, index) => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                index={index}
                onAction={handleAction}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <span className="material-symbols-outlined text-3xl text-slate-300">
              filter_alt_off
            </span>
            <p className="text-sm font-bold text-slate-700">
              Nothing in this view
            </p>
            <p className="max-w-xs text-xs text-slate-500">
              Pools you stake, win, or create land here.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-600/30 text-lg text-indigo-300">
              ⚡
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">
                Ready to lock your streak?
              </h4>
              <p className="text-xs font-normal text-slate-300">
                Lock your stake on Bitcoin Lightning Mutinynet and claim
                verified rewards.
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

      <GoalyChat
        arbiter={arbiter}
        prefill={prefill}
        open={chatOpen}
        onToggle={toggleChat}
      />
    </main>
  );
}
