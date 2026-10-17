import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";

import { EASE } from "~/lib/motion";

/**
 * Motion primitives shared by the two arbiter chats — the arena panel and the
 * create builder — so both feel like one system.
 *
 * Everything here is decorative. `MotionConfig reducedMotion="user"` in the
 * root turns the transforms off for visitors who ask for less motion.
 */

/** Wraps a bubble so it eases in the first time it appears. */
export function MessageIn({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.26, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Bare three-dot row; it bounces only while the arbiter is working. */
function Dots({ active }: { active: boolean }) {
  return (
    <>
      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          className="h-1.5 w-1.5 rounded-full bg-indigo-600"
          animate={active ? { y: [0, -3, 0] } : { y: 0 }}
          transition={{
            duration: active ? 0.6 : 0.2,
            repeat: active ? Infinity : 0,
            delay: active ? index * 0.12 : 0,
            ease: "easeInOut",
          }}
        />
      ))}
    </>
  );
}

/** The pill version, used inline in the arena panel's status row. */
export function TypingDots({ active }: { active: boolean }) {
  return (
    <span
      className={`flex items-center gap-1 rounded-full px-2 py-1 transition-colors ${
        active ? "border border-indigo-100 bg-indigo-50" : "bg-slate-100"
      }`}
    >
      <Dots active={active} />
    </span>
  );
}

/** Goaly's placeholder bubble, shown while a reply is being drafted. */
export function TypingBubble({ label }: { label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ duration: 0.22, ease: EASE }}
      className="flex w-fit items-center gap-2.5 rounded-2xl border border-slate-200/90 bg-slate-50 px-4 py-3 shadow-sm"
    >
      <span className="flex items-center gap-1">
        <Dots active />
      </span>
      <span className="text-[11px] font-semibold text-slate-400">{label}</span>
    </motion.div>
  );
}

/** The arbiter's status line, cross-fading whenever it changes. */
export function StatusLabel({
  working,
  idleText,
}: {
  working: boolean;
  idleText: string;
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={working ? "working" : "idle"}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.18, ease: EASE }}
        className={working ? "font-semibold text-indigo-600" : undefined}
      >
        {working ? "Goaly is computing DLC parameters..." : idleText}
      </motion.span>
    </AnimatePresence>
  );
}
