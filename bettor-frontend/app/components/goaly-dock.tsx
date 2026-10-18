import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { askGoaly } from "~/lib/goaly";
import { useGoalyBuilderDraft } from "~/lib/goaly-builder-context";
import { DOWNLOAD_INSTRUCTIONS_HINT, GOALY_CHAT_ENABLED } from "~/lib/feature-flags";
import { Icon } from "~/components/icon";

type Message = { id: number; role: "assistant" | "user"; text: string };

const UNAVAILABLE_NOTICE = `Goaly chat is unavailable in this build. ${DOWNLOAD_INSTRUCTIONS_HINT}`;

function greeting(builderMode: boolean) {
  if (!GOALY_CHAT_ENABLED) return UNAVAILABLE_NOTICE;
  return builderMode
    ? "Let’s build your challenge. Tell me what you want to accomplish. I’ll help fill the draft; you review the details and approve any wallet payment."
    : "I can help you make a clear goal and choose a proof source. I cannot approve wallet payments or move funds.";
}

export function GoalyDock() {
  const { pathname } = useLocation();
  const builderMode = pathname === "/challenges/new";
  const builderDraft = useGoalyBuilderDraft().draft;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, role: "assistant", text: greeting(false) },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([{ id: 0, role: "assistant", text: greeting(builderMode) }]);
    nextId.current = 1;
  }, [builderMode]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!GOALY_CHAT_ENABLED) return;
    const prompt = input.trim();
    if (!prompt || busy) return;
    setInput("");
    setMessages((current) => [
      ...current,
      { id: nextId.current++, role: "user", text: prompt },
    ]);
    setBusy(true);
    try {
      const conversation = [
        ...messages.map(({ role, text }) => ({ role, content: text })),
        { role: "user" as const, content: prompt },
      ];
      const reply = await askGoaly(conversation, builderMode ? builderDraft : undefined);
      if (reply.draft) {
        window.dispatchEvent(new CustomEvent("goaly:builder:apply", { detail: reply.draft }));
      }
      setMessages((current) => [
        ...current,
        { id: nextId.current++, role: "assistant", text: reply.answer },
      ]);
    } catch (cause) {
      setMessages((current) => [
        ...current,
        {
          id: nextId.current++,
          role: "assistant",
          text: cause instanceof Error ? cause.message : "Goaly is unavailable. Try again.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className={`fixed bottom-0 right-4 z-[60] flex h-[min(34rem,78vh)] w-[min(26rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-t-2xl border border-b-0 border-indigo-200 bg-white shadow-2xl transition-transform duration-300 ease-out ${
        open ? "translate-y-0" : "translate-y-[calc(100%-3.5rem)]"
      }`}
      aria-label="Goaly assistant"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls="goaly-dock-content"
        onClick={() => setOpen((value) => !value)}
        className="flex h-14 shrink-0 items-center justify-between gap-3 bg-indigo-600 px-4 text-left text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-white"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/30 bg-white">
            <img src="/goaly.png" alt="" className="h-full w-full object-contain" />
          </span>
          <span>
            <span className="block text-sm font-extrabold">Goaly</span>
            <span className="block text-[10px] text-indigo-100">{builderMode ? "Challenge builder" : "Local challenge assistant"}</span>
          </span>
        </span>
        <span aria-hidden="true" className="text-xl leading-none">{open ? "⌄" : "⌃"}</span>
      </button>

      <div
        id="goaly-dock-content"
        aria-hidden={!open}
        inert={!open}
        className="flex min-h-0 flex-1 flex-col"
      >
        {!GOALY_CHAT_ENABLED ? (
          <div
            role="alert"
            className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            <p className="flex items-start gap-2 font-semibold">
              <Icon name="warning" className="mt-0.5 text-base text-amber-600" />
              Goaly chat is unavailable
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-800">
              {DOWNLOAD_INSTRUCTIONS_HINT}
            </p>
          </div>
        ) : null}
        <div
          role="log"
          aria-live="polite"
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-slate-50 p-4"
        >
          {messages.map((message) => (
            <p
              key={message.id}
              className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-3.5 py-3 text-sm leading-relaxed ${
                message.role === "user"
                  ? "self-end rounded-br-sm bg-indigo-600 text-white"
                  : "self-start rounded-bl-sm border border-slate-200 bg-white text-slate-700 shadow-sm"
              }`}
            >
              {message.text}
            </p>
          ))}
          {busy ? (
            <p role="status" className="self-start text-xs font-medium text-slate-500">
              Goaly is thinking…
            </p>
          ) : null}
          <div ref={endRef} />
        </div>

        <form onSubmit={(event) => void send(event)} className="flex shrink-0 gap-2 border-t border-slate-200 bg-white p-3">
          <label className="sr-only" htmlFor="goaly-dock-input">Ask Goaly</label>
          <input
            id="goaly-dock-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={
              !GOALY_CHAT_ENABLED
                ? "Follow the download instructions to enable Goaly…"
                : builderMode
                  ? "Describe the challenge you want to create…"
                  : "Ask Goaly about your goal…"
            }
            maxLength={500}
            disabled={!GOALY_CHAT_ENABLED}
            className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
          />
          <button
            type="submit"
            disabled={!GOALY_CHAT_ENABLED || !input.trim() || busy}
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </section>
  );
}
