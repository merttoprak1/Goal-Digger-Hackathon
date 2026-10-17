import { useEffect, useRef, useState } from "react";
import { askGoaly } from "~/lib/goaly";
import type { ArbiterProfile } from "~/lib/contracts";

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

export function ArbiterPanel({ arbiter }: { arbiter: ArbiterProfile }) {
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
