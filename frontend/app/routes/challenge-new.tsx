import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";

import type { Route } from "./+types/challenge-new";
import { Icon } from "~/components/icon";
import { createAndPayStake } from "~/lib/wallet";
import { askGoaly } from "~/lib/goaly";
import { boardSession, createBoardClient } from "~/lib/board";

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
    body: "This choice is saved with the draft. It does not move funds.",
    badge: null,
  },
  {
    id: "burn" as const,
    emoji: "🔥",
    title: "Burn the Stake (Proof-of-Burn)",
    body: "This choice is saved with the draft. It does not move funds.",
    badge: "Hardcore",
  },
  {
    id: "rollover" as const,
    emoji: "🔄",
    title: "Rollover to Next Week's Goal Vault",
    body: "This choice is saved with the draft. It does not move funds.",
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

const GREETING: ChatMessage[] = [
  {
    id: 1,
    from: "goaly",
    text: "I am Goaly, your local challenge planning assistant. Describe a measurable goal and how you will prove it.",
    detail: "I cannot connect a proof source or move funds.",
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
        <span className="text-base font-bold text-slate-900">Goaly</span>
      </div>
    </div>
  );
}

function GoalyBubble({ message }: { message: ChatMessage }) {
  return (
    <div className="chat-bubble-tail-left rounded-2xl border border-slate-200/90 bg-slate-50 p-3.5 shadow-sm">
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
    </div>
  );
}

function UserBubble({ message }: { message: ChatMessage }) {
  return (
    <div className="max-w-[92%] self-end rounded-2xl rounded-br-sm bg-indigo-600 p-3 text-xs text-white shadow-sm">
      <p className="leading-relaxed font-medium">{message.text}</p>
      <div className="mt-1.5 flex items-center justify-end gap-1">
        <span className="font-mono text-[9px] text-indigo-200">Just now</span>
        <Icon name="done_all" className="text-[13px] text-indigo-200" />
      </div>
    </div>
  );
}

/* --------------------------------- screen -------------------------------- */

export default function ChallengeNew() {
  const navigate = useNavigate();

  const [messages, setMessages] = useState<ChatMessage[]>(GREETING);
  const [input, setInput] = useState("");
  const [visibility, setVisibility] = useState<VisibilityId>("public");
  const [forfeit, setForfeit] = useState<ForfeitId>("donate");
  const [charity, setCharity] = useState(CHARITIES[0]);
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

  const [chatBusy,setChatBusy]=useState(false);
  const nextId = useRef(GREETING.length + 1);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((id) => window.clearTimeout(id));
  }, []);

  async function send(raw: string) {
    const text=raw.trim();
    if(!text || chatBusy)return;
    setInput('');setChatBusy(true);
    setMessages(current=>[...current,{id:nextId.current++,from:'user',text}]);
    try {
      const reply=await askGoaly(text);
      setMessages(current=>[...current,{id:nextId.current++,from:'goaly',text:reply}]);
    } catch(e) {
      setMessages(current=>[...current,{id:nextId.current++,from:'goaly',text:e instanceof Error?e.message:'Goaly is unavailable. Try again.'}]);
    } finally {setChatBusy(false);}
  }

  const stakeNumber = Number(stake);

  async function submit() {
    if (pending) return;
    setError(null);
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
        forfeit,
        charity: forfeit === "donate" ? charity : undefined,
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
          Creating a challenge does not move funds.
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

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* ------------------------------ arbiter chat ----------------------------- */}
        <div className="flex flex-col gap-4 lg:col-span-5">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <GoalyHeader />
          </section>

          <section className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            {messages.map((message) =>
              message.from === "goaly" ? (
                <GoalyBubble key={message.id} message={message} />
              ) : (
                <UserBubble key={message.id} message={message} />
              ),
            )}
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
                  onClick={() => setInput(prompt.text)}
                  className="cursor-pointer rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  {prompt.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 transition focus-within:border-indigo-500 focus-within:bg-white">
              <Icon name="notes" className="text-[18px] text-slate-400" />
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    send(input);
                  }
                }}
                placeholder={chatBusy?"Goaly is thinking…":"Describe your challenge…"}
                className="min-w-0 flex-1 border-0 bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
              />
              <Icon name="mic" className="text-[18px] text-slate-400" />
              <button
                type="button"
                onClick={() => send(input)}
                disabled={!input.trim() || chatBusy}
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
                Goal Digger operates the WDK vault and controls its funds
              </p>
            </div>
          </div>
        </div>

        {/* ------------------------------- step builder ---------------------------- */}
        <div className="flex flex-col gap-5 lg:col-span-7">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">
              Write the challenge
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              These three fields are what gets saved. The chat does not create
              the draft.
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
                The forfeit choice is saved with the draft. Saving does not move
                funds.
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
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
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
              Planned deposits use the operator-controlled WDK vault on Mutinynet
              Bitcoin Taproot.
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
      </div>
    </main>
  );
}
