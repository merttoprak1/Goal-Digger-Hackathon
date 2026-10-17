import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";

import type { Route } from "./+types/challenge-new";
import { MessageIn, TypingBubble } from "~/components/chat";
import { CountUp } from "~/components/count-up";
import { Icon } from "~/components/icon";
import { createChallenge } from "~/lib/api";
import { EASE } from "~/lib/motion";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Create Challenge · Goal Digger" }];
}

/* --------------------------------- config -------------------------------- */

/** Placeholder for the signed-in user until auth exists. */
const CREATOR = "Mert Toprak";
const WALLET_USDT = 82.5;
const ORACLE_LABEL = "Apple Health + Camera Feed";
const HORIZON_OPTIONS = [3, 5, 7, 14];

const VISIBILITY = [
  {
    id: "public" as const,
    icon: "public",
    title: "Public Arena",
    badge: "Peer-to-Peer",
    body: "Open to community counter-bets. Anyone can bet against your goal. If you succeed, you sweep their stakes!",
    perk: "⚡ High Reward Multiplier (up to 3.5x)",
  },
  {
    id: "solo" as const,
    icon: "lock",
    title: "Solo Discipline",
    badge: null,
    body: "Just you against your own word. Stake your funds to build true habit momentum. Complete it to claim your principal + XP",
    perk: "🛡 Self-Accountability Guaranteed",
  },
];

const FORFEITS = [
  {
    id: "donate" as const,
    emoji: "🎗",
    title: "Donate to Verified Charity",
    body: "Turn failure into a noble deed. Funds are pushed directly to non-profit multisig.",
    badge: null,
  },
  {
    id: "burn" as const,
    emoji: "🔥",
    title: "Burn the Stake (Proof-of-Burn)",
    body: "Sent to unspendable OP_RETURN burn address bc1q...dead0000 forever.",
    badge: "Hardcore",
  },
  {
    id: "rollover" as const,
    emoji: "🔄",
    title: "Rollover to Next Week's Goal Vault",
    body: "Locked into your personal disciplinary timelock for 14 additional days.",
    badge: "Timelock",
  },
];

const CHARITIES = [
  "Water.org (Bitcoin Clean Water)",
  "Electronic Frontier Foundation",
  "Doctors Without Borders",
];

const QUICK_PROMPTS = [
  { label: "🏃 Run 5km", text: "Run 5km every morning for 7 days" },
  { label: "📖 Read 30 min", text: "Read 30 minutes daily for 14 days" },
  { label: "💻 Commit code daily", text: "Commit code to GitHub every day for 10 days" },
  { label: "⏰ Wake up 07:00", text: "Wake up at 07:00 for 5 consecutive days" },
  { label: "🍬 Zero sugar 3d", text: "Zero added sugar for 3 days" },
];

const QUICK_STAKES = ["1", "5", "10", "25"];

const GOALY_REPLIES = [
  "Locked in. I've mapped your milestone to the Apple Health oracle and set the daily quota. Adjust the horizon on the right if you need more room.",
  "Solid target. The proof feed is connected and the escrow terms are drafted — deploy whenever you're ready to put USDT behind it.",
  "Noted, challenger. I'll attest the oracle feed and rule on the outcome myself. No excuses, no manual disputes.",
];

const GREETING: ChatMessage[] = [
  {
    id: 1,
    from: "goaly",
    text: "Hey! I'm Goaly, your automated arbiter. What goal or discipline challenge are we locking into Bitcoin escrow today?",
    detail:
      '💡 Examples: "Run 10km under 60 mins" • "100 pushups daily" • "Skip 5 GitHub commits"',
  },
  {
    id: 2,
    from: "user",
    text: "I want to do 100 pushups daily for 5 days tracked via Apple Fitness / camera proof.",
  },
  {
    id: 3,
    from: "goaly",
    text: "Awesome challenge! 🔥 I've auto-configured the oracle listeners for Apple Health & Camera Validator.",
    oracle: "5 consecutive days • 100 reps quota",
  },
];

type ChatMessage = {
  id: number;
  from: "goaly" | "user";
  text: string;
  detail?: string;
  oracle?: string;
};

type VisibilityId = "public" | "solo";
type ForfeitId = "donate" | "burn" | "rollover";

/* --------------------------------- deploy -------------------------------- */

/**
 * The stages a real deploy would walk through. DLCs are not implemented yet, so
 * these are purely for the demo — but they make the flow read as one continuous
 * action instead of a spinner that suddenly changes the page.
 */
const DEPLOY_STEPS = [
  "Signing DLC attestation with the Goaly oracle key",
  "Broadcasting the funding transaction to Mutinynet",
  "Locking your stake in Taproot escrow",
  "DLC locked — waiting for the first oracle tick",
];

/** Block height the deploy readout counts up from, one per stage. */
const DEPLOY_BLOCK = 2_847_193;

/* --------------------------------- helpers ------------------------------- */

/** `+03:00`-style offset, which is what the API schema expects. */
function isoWithOffset(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
    `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`,
  ].join("");
}

/* ------------------------------- components ------------------------------ */

function GoalyHeader() {
  return (
    <div className="flex items-center gap-3">
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-indigo-50 p-1">
        <img
          src="/panda-avatar.png"
          alt=""
          className="h-full w-full rounded-xl object-cover"
        />
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-bold text-slate-900">Goaly</span>
          <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold tracking-wide text-indigo-700 uppercase">
            AI Arbiter
          </span>
        </div>
        <p className="text-xs font-medium text-slate-500">
          Discreet Log Oracle • Level 42 Referee
        </p>
      </div>
    </div>
  );
}

function GoalyBubble({ message }: { message: ChatMessage }) {
  return (
    <MessageIn className="chat-bubble-tail-left rounded-2xl border border-slate-200/90 bg-slate-50 p-3.5 shadow-sm">
      <p className="text-xs leading-relaxed font-medium text-slate-700">
        {message.text}
      </p>
      {message.detail ? (
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
          {message.detail}
        </p>
      ) : null}
      {message.oracle ? (
        <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-emerald-200/70 bg-white px-3 py-2">
          <Icon
            name="verified_user"
            filled
            className="text-[16px] text-emerald-500"
          />
          <div>
            <p className="text-[11px] font-bold text-slate-700">
              Oracle Verified
            </p>
            <p className="text-[10px] font-medium text-slate-500">
              {message.oracle}
            </p>
          </div>
        </div>
      ) : null}
    </MessageIn>
  );
}

function UserBubble({ message }: { message: ChatMessage }) {
  return (
    <MessageIn className="max-w-[92%] self-end rounded-2xl rounded-br-sm bg-indigo-600 p-3 text-xs text-white shadow-sm">
      <p className="leading-relaxed font-medium">{message.text}</p>
      <div className="mt-1.5 flex items-center justify-end gap-1">
        <span className="font-mono text-[9px] text-indigo-200">
          {message.id === 2 ? "10:42 AM" : "Just now"}
        </span>
        <Icon name="done_all" className="text-[13px] text-indigo-200" />
      </div>
    </MessageIn>
  );
}

function StakeChip({
  label,
  value,
  active,
  onSelect,
}: {
  label: string;
  value: string;
  active: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={[
        "relative cursor-pointer rounded-lg px-2.5 py-1 font-mono text-[11px] font-bold transition-colors",
        active
          ? "text-white"
          : "border border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-700",
      ].join(" ")}
    >
      {/* Same hand-off trick as the header nav: one pill, moved between chips. */}
      {active ? (
        <motion.span
          layoutId="stake-chip"
          transition={{ type: "spring", stiffness: 480, damping: 34 }}
          className="absolute inset-0 rounded-lg bg-emerald-600"
        />
      ) : null}
      <span className="relative z-10">{label}</span>
    </button>
  );
}

function DeployStep({
  label,
  state,
}: {
  label: string;
  state: "pending" | "active" | "done";
}) {
  return (
    <div
      className={`flex items-center gap-2 text-[11px] font-semibold transition-colors duration-300 ${
        state === "pending" ? "text-indigo-300" : "text-indigo-800"
      }`}
    >
      <span className="grid h-4 w-4 shrink-0 place-items-center">
        <AnimatePresence mode="wait" initial={false}>
          {state === "done" ? (
            <motion.span
              key="done"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ type: "spring", stiffness: 520, damping: 26 }}
            >
              <Icon
                name="check_circle"
                filled
                className="text-[14px] text-emerald-500"
              />
            </motion.span>
          ) : state === "active" ? (
            <motion.span
              key="active"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <span className="loading loading-spinner loading-xs text-indigo-600" />
            </motion.span>
          ) : (
            <motion.span
              key="pending"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="h-1.5 w-1.5 rounded-full bg-indigo-200"
            />
          )}
        </AnimatePresence>
      </span>
      {label}
    </div>
  );
}

/* --------------------------------- screen -------------------------------- */

export default function ChallengeNew() {
  const navigate = useNavigate();

  const [messages, setMessages] = useState<ChatMessage[]>(GREETING);
  const [input, setInput] = useState("");
  const [visibility, setVisibility] = useState<VisibilityId>("solo");
  const [forfeit, setForfeit] = useState<ForfeitId>("donate");
  const [charity, setCharity] = useState(CHARITIES[0]);
  const [stake, setStake] = useState("5.00");
  const [horizonDays, setHorizonDays] = useState(5);
  const [pending, setPending] = useState<"idle" | "draft" | "deploy">("idle");
  const [error, setError] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [step, setStep] = useState(-1);
  const [promptFlash, setPromptFlash] = useState(false);

  const nextId = useRef(GREETING.length + 1);
  const timers = useRef<number[]>([]);
  const feedRef = useRef<HTMLElement>(null);
  const stickToBottom = useRef(true);
  const promptInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((id) => window.clearTimeout(id));
  }, []);

  // Chat convention: follow the newest message only while the reader is already
  // at the bottom, so scrolling up to re-read stays put. The pin is recomputed
  // just before each append (see `pinIfAtBottom`), while the feed still reflects
  // the pre-append scroll position.
  useEffect(() => {
    const feed = feedRef.current;
    if (feed && stickToBottom.current) feed.scrollTop = feed.scrollHeight;
  }, [messages, typing]);

  function pinIfAtBottom() {
    const feed = feedRef.current;
    if (!feed) return;
    stickToBottom.current =
      feed.scrollHeight - feed.scrollTop - feed.clientHeight < 40;
  }

  /** Registers the timer so unmounting mid-deploy cannot resolve it late. */
  function wait(ms: number) {
    return new Promise<void>((resolve) => {
      timers.current.push(window.setTimeout(resolve, ms));
    });
  }

  /** A quick prompt types for you, so the field flashes to show what landed. */
  function applyPrompt(text: string) {
    setInput(text);
    promptInputRef.current?.focus();
    setPromptFlash(true);
    timers.current.push(
      window.setTimeout(() => setPromptFlash(false), 650),
    );
  }

  function send(raw: string) {
    const text = raw.trim();
    if (!text) return;

    setInput("");
    pinIfAtBottom();
    setTyping(true);
    setMessages((current) => [
      ...current,
      { id: nextId.current++, from: "user", text },
    ]);

    const timer = window.setTimeout(() => {
      pinIfAtBottom();
      setTyping(false);
      setMessages((current) => [
        ...current,
        {
          id: nextId.current++,
          from: "goaly",
          text: GOALY_REPLIES[
            Math.floor(Math.random() * GOALY_REPLIES.length)
          ],
          oracle: `${horizonDays} consecutive days • auto-attested daily`,
        },
      ]);
    }, 600);
    timers.current.push(timer);
  }

  const goalText =
    [...messages].reverse().find((message) => message.from === "user")?.text ??
    "Custom challenge";
  const title =
    goalText.length > 110 ? `${goalText.slice(0, 109)}…` : goalText;

  const stakeNumber = Number(stake);
  const xp = Number.isFinite(stakeNumber)
    ? Math.round(Math.max(0, stakeNumber) * 70)
    : 0;

  const defaultOutcome =
    forfeit === "donate"
      ? `${charity.split(" (")[0]} Clean Water Fund`
      : forfeit === "burn"
        ? "OP_RETURN Burn • bc1q…dead0000"
        : "Goal Vault Rollover • +14 days";

  const deployComplete = step >= DEPLOY_STEPS.length;

  async function submit(mode: "draft" | "deploy") {
    setError(null);
    setPending(mode);

    const amount =
      Number.isFinite(stakeNumber) && stakeNumber > 0
        ? String(stakeNumber)
        : "1";
    const deadline = new Date(Date.now() + horizonDays * 86_400_000);

    try {
      if (mode === "deploy") {
        // Walk the stages, then hold on the completed state long enough for the
        // tick to land before the route changes.
        for (let index = 0; index < DEPLOY_STEPS.length; index += 1) {
          setStep(index);
          await wait(560);
        }
        setStep(DEPLOY_STEPS.length);
        await wait(560);
      }

      await createChallenge({
        template: "custom",
        creator: CREATOR,
        title,
        stakeUsdt: amount,
        proofSource: ORACLE_LABEL,
        proofDeadline: isoWithOffset(deadline),
      });
      navigate("/challenges");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not create the challenge.",
      );
      setPending("idle");
      setStep(-1);
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
            Custom DLC Contract Builder
          </span>
        </div>

        <span className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          ORACLE SYNCED: MUTINYNET BLOCK #849,203
          <span className="text-emerald-300">•</span>
          DLC v0.4 Active
        </span>
      </div>

      <div className="flex flex-col items-center gap-2.5 border-b border-slate-200 pb-6 text-center">
        <span className="flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-bold tracking-wide text-indigo-700 uppercase">
          <Icon name="bolt" className="text-[14px]" />
          Powered by Goaly Arbiter
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Create Custom Challenge
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-500 sm:text-base">
          Chat with Goaly to define your verifiable milestone, connect proof
          feeds, and deploy a Discreet Log Contract escrow in seconds.
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* ------------------------------ arbiter chat ----------------------------- */}
        <div className="flex flex-col gap-4 lg:col-span-5">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <GoalyHeader />
            <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold text-emerald-600">
                Verified Contract Signer
              </span>
            </div>
          </section>

          <section
            ref={feedRef}
            className="chat-feed flex max-h-[22rem] flex-col gap-3 overflow-y-auto overscroll-contain rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
          >
            {messages.map((message) =>
              message.from === "goaly" ? (
                <GoalyBubble key={message.id} message={message} />
              ) : (
                <UserBubble key={message.id} message={message} />
              ),
            )}
            <AnimatePresence>
              {typing ? (
                <TypingBubble
                  key="typing"
                  label="Goaly is drafting the DLC terms…"
                />
              ) : null}
            </AnimatePresence>
          </section>

          <section className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              Quick Prompts:
            </span>
            <div className="flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt.label}
                  type="button"
                  onClick={() => applyPrompt(prompt.text)}
                  className="cursor-pointer rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  {prompt.label}
                </button>
              ))}
            </div>

            <div
              className={[
                "flex items-center gap-2 rounded-2xl border p-2 transition-colors duration-500 focus-within:border-indigo-500 focus-within:bg-white",
                promptFlash
                  ? "border-indigo-400 bg-indigo-50"
                  : "border-slate-200 bg-slate-50",
              ].join(" ")}
            >
              <Icon name="notes" className="text-[18px] text-slate-400" />
              <input
                ref={promptInputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    send(input);
                  }
                }}
                placeholder="Describe your challenge…"
                className="min-w-0 flex-1 border-0 bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
              />
              <Icon name="mic" className="text-[18px] text-slate-400" />
              <button
                type="button"
                onClick={() => send(input)}
                disabled={!input.trim()}
                title="Send to Goaly"
                className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icon name="arrow_upward" className="text-[18px]" />
              </button>
            </div>

            <div className="flex items-center justify-between text-[10px] font-medium text-slate-400">
              <span>Press Return to submit</span>
              <span className="flex items-center gap-1 font-semibold text-indigo-500">
                <Icon name="bolt" className="text-[13px]" />
                Natural Language Parser v2
              </span>
            </div>
          </section>

          <div className="flex items-center gap-3 rounded-2xl border border-emerald-200/70 bg-emerald-50/60 p-4">
            <Icon name="key" className="text-[20px] text-emerald-600" />
            <div>
              <p className="text-xs font-bold text-emerald-800">
                Zero Counterparty Risk
              </p>
              <p className="text-[11px] text-emerald-700">
                DLC oracles can only sign outcomes, never touch staked funds
              </p>
            </div>
          </div>
        </div>

        {/* ------------------------------- step builder ---------------------------- */}
        <div className="flex flex-col gap-5 lg:col-span-7">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <Icon name="explore" className="text-[20px] text-indigo-500" />
                Step 1: Challenge Visibility &amp; Ruleset
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-400">
                  Taproot Mode
                </span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                  ✓ Active Selection
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {VISIBILITY.map((option) => {
                const selected = visibility === option.id;
                return (
                  <motion.button
                    key={option.id}
                    type="button"
                    whileTap={{ scale: 0.985 }}
                    onClick={() => setVisibility(option.id)}
                    className={[
                      "relative flex cursor-pointer flex-col gap-2 rounded-2xl border p-4 text-left transition",
                      selected
                        ? "border-indigo-400 bg-indigo-50/70 ring-1 ring-indigo-200"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    {selected ? (
                      <motion.span
                        initial={{ scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{
                          type: "spring",
                          stiffness: 520,
                          damping: 26,
                        }}
                        className="absolute -top-2 -right-2 grid h-5 w-5 place-items-center rounded-full bg-indigo-600 text-white shadow-sm"
                      >
                        <Icon name="check" className="text-[13px]" />
                      </motion.span>
                    ) : null}
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
                  </motion.button>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                  <Icon
                    name="volunteer_activism"
                    className="text-[20px] text-rose-500"
                  />
                  Failure Forfeit &amp; Charity Donation
                </h2>
                <p className="mt-0.5 text-[11px] font-medium text-slate-400">
                  Hayır Kurumu Bağış Maddesi
                </p>
              </div>
              <span className="flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-600">
                <Icon name="receipt_long" className="text-[14px]" />
                100% On-Chain Proof
              </span>
            </div>

            <div className="mt-4 rounded-xl bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-800">
                What happens if you miss your deadline?
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                In solo mode, your stake doesn&apos;t disappear into a black box.
                If the oracle confirms uncompleted targets, the Discreet Log
                Contract routes your deposit directly to a public cause.
              </p>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              {FORFEITS.map((option) => {
                const selected = forfeit === option.id;
                return (
                  <div
                    key={option.id}
                    className={[
                      "rounded-xl border px-4 py-3 transition",
                      selected
                        ? "border-indigo-300 bg-indigo-50/50"
                        : "border-slate-200 bg-white",
                    ].join(" ")}
                  >
                    <button
                      type="button"
                      onClick={() => setForfeit(option.id)}
                      className="flex w-full cursor-pointer items-start gap-3 text-left"
                    >
                      <span
                        className={[
                          "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 transition",
                          selected
                            ? "border-indigo-600 bg-indigo-600"
                            : "border-slate-300 bg-white",
                        ].join(" ")}
                      >
                        {selected ? (
                          <motion.span
                            initial={{ scale: 0.3, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{
                              type: "spring",
                              stiffness: 600,
                              damping: 24,
                            }}
                            className="h-1.5 w-1.5 rounded-full bg-white"
                          />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            {option.emoji} {option.title}
                          </span>
                          {option.badge ? (
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold tracking-wide text-slate-500 uppercase">
                              {option.badge}
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-1 block text-[11px] leading-relaxed text-slate-500">
                          {option.body}
                        </span>
                      </span>
                    </button>

                    {selected && option.id === "donate" ? (
                      <div className="mt-3 pl-7">
                        <select
                          value={charity}
                          onChange={(event) => setCharity(event.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-indigo-500 focus:outline-none"
                        >
                          {CHARITIES.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                  </div>
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
                  <span className="font-mono text-[11px] font-semibold text-slate-400">
                    Wallet: {WALLET_USDT.toFixed(2)} USDT
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
                  <Icon
                    name="check_circle"
                    filled
                    className="text-[16px] text-emerald-500"
                  />
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {QUICK_STAKES.map((amount) => (
                    <StakeChip
                      key={amount}
                      label={`${amount} USDT`}
                      value={amount}
                      active={stakeNumber === Number(amount)}
                      onSelect={setStake}
                    />
                  ))}
                  <StakeChip
                    label="MAX"
                    value={WALLET_USDT.toFixed(2)}
                    active={stakeNumber === WALLET_USDT}
                    onSelect={setStake}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700">
                    Challenge Horizon
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    Auto-Locks at 23:59 UTC
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
                      setHorizonDays(
                        HORIZON_OPTIONS[
                          (index + 1) % HORIZON_OPTIONS.length
                        ],
                      );
                    }}
                    className="cursor-pointer text-[11px] font-bold text-indigo-600 transition hover:text-indigo-800"
                  >
                    Adjust
                  </button>
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] font-medium text-slate-400">
                  <span>Start: Immediately upon signature</span>
                  <span>Oracle Tick: Daily 24h</span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
                  <Icon name="health_and_safety" className="text-[19px]" />
                </span>
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    Proof Oracle: {ORACLE_LABEL}
                  </p>
                  <p className="font-mono text-[10px] text-slate-400">
                    Attestation signed via Goaly Schnorr public key: pubkey:82b64f
                    ...a931
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold tracking-wide text-emerald-700 uppercase">
                  Automated
                </span>
                <button
                  type="button"
                  className="flex cursor-pointer items-center gap-1 text-[11px] font-bold text-indigo-600 transition hover:text-indigo-800"
                >
                  View Oracle Spec
                  <Icon name="open_in_new" className="text-[14px]" />
                </button>
              </div>
            </div>

            <p className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
              <Icon
                name="verified_user"
                className="text-[15px] text-emerald-500"
              />
              Secured with non-custodial 2-of-3 Multi-Sig escrow on Mutinynet
              Bitcoin Taproot.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-500">
                  Staked Principal
                </span>
                <span className="font-mono font-bold text-slate-900">
                  {xp > 0 ? Number(stake).toFixed(2) : "0.00"}{" "}
                  <span className="text-[10px] font-semibold text-slate-400">
                    USDT
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-500">
                  Potential Gamified Return (
                  {visibility === "solo" ? "Solo XP" : "Public Pool"})
                </span>
                <span className="font-mono font-bold text-indigo-600">
                  +<CountUp
                    text={xp.toLocaleString("en-US")}
                    duration={0.45}
                  />{" "}
                  XP = Habit Streak
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-500">
                  Taproot Escrow Miner Fee (Mutinynet)
                </span>
                <span className="font-mono font-bold text-slate-700">
                  ~0.00001200 BTC{" "}
                  <span className="text-[10px] font-semibold text-slate-400">
                    (~$0.00 Testnet)
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-500">
                  Default Outcome on Incompletion
                </span>
                <span className="font-mono font-bold text-violet-600">
                  {defaultOutcome}
                </span>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {pending === "deploy" ? (
                <motion.div
                  key="deploy"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 flex flex-col gap-2 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold tracking-wider text-indigo-700 uppercase">
                        Deploying DLC
                      </span>
                      <span className="font-mono text-[10px] font-semibold text-indigo-500">
                        Mutinynet · block{" "}
                        {(DEPLOY_BLOCK + Math.max(0, step)).toLocaleString(
                          "en-US",
                        )}
                      </span>
                    </div>
                    {DEPLOY_STEPS.map((label, index) => (
                      <DeployStep
                        key={label}
                        label={label}
                        state={
                          index < step
                            ? "done"
                            : index === step
                              ? "active"
                              : "pending"
                        }
                      />
                    ))}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {error ? (
              <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                {error}
              </p>
            ) : null}

            <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row">
              <button
                type="button"
                disabled={pending !== "idle"}
                onClick={() => submit("draft")}
                className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending === "draft" ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : null}
                Save Draft
              </button>
              <motion.button
                type="button"
                disabled={pending !== "idle"}
                whileTap={{ scale: 0.98 }}
                onClick={() => submit("deploy")}
                className="flex flex-[1.6] cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {pending === "deploy" ? (
                    <motion.span
                      key={deployComplete ? "locked" : "deploying"}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18, ease: EASE }}
                      className="flex items-center gap-2"
                    >
                      {deployComplete ? (
                        <Icon
                          name="check_circle"
                          filled
                          className="text-[18px]"
                        />
                      ) : (
                        <span className="loading loading-spinner loading-xs" />
                      )}
                      {deployComplete ? "DLC Locked" : "Deploying DLC…"}
                    </motion.span>
                  ) : (
                    <motion.span
                      key="idle"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18, ease: EASE }}
                      className="flex items-center gap-2"
                    >
                      <Icon name="bolt" className="text-[18px]" />
                      Lock Stake &amp; Deploy DLC
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>

            <p className="mt-3 text-center text-[11px] font-medium text-slate-400">
              By locking funds you authorize Goaly AI Oracle to attest state
              transitions based on verified health data.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
