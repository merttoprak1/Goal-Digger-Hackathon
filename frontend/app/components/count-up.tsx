import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect, useMemo } from "react";

/**
 * Counts a display string up from zero on mount, and glides towards the new
 * value whenever the string changes.
 *
 * The number is parsed out of the final display string, so a caller passes
 * exactly what it would otherwise have rendered — `"78.4%"`, `"420.50"`,
 * `"1,450"` — and the percent sign, thousands separators and decimal places all
 * survive. Anything without a number in it is rendered untouched.
 *
 * Decorative: `MotionConfig reducedMotion="user"` in the root turns the counting
 * off for visitors who ask for less motion.
 */
export function CountUp({
  /** The final display string, e.g. `"78.4%"`. */
  text,
  /** Seconds to wait first, to line up with a card entrance. */
  delay = 0,
  /** Seconds the count takes. Short values suit live-updating figures. */
  duration = 0.9,
  className,
}: {
  text: string;
  delay?: number;
  duration?: number;
  className?: string;
}) {
  const parsed = useMemo(() => parseDisplay(text), [text]);
  const progress = useMotionValue(0);
  const display = useTransform(progress, (latest) =>
    parsed ? formatDisplay(parsed, latest) : text,
  );

  useEffect(() => {
    if (!parsed) return;
    const controls = animate(progress, parsed.value, {
      duration,
      delay,
      ease: "easeOut",
    });
    return () => controls.stop();
  }, [progress, parsed, delay, duration]);

  if (!parsed) return <span className={className}>{text}</span>;
  return <motion.span className={className}>{display}</motion.span>;
}

type ParsedDisplay = {
  prefix: string;
  value: number;
  suffix: string;
  decimals: number;
  grouped: boolean;
};

/** `"78.4%"` → `{ prefix: "", value: 78.4, suffix: "%", decimals: 1, … }`. */
function parseDisplay(text: string): ParsedDisplay | null {
  const match = text.match(/^([^\d-]*)(-?[\d,]*\.?\d+)(.*)$/);
  if (!match) return null;

  const [, prefix, rawNumber, suffix] = match;
  const value = Number(rawNumber.replace(/,/g, ""));
  if (!Number.isFinite(value)) return null;

  const dot = rawNumber.indexOf(".");
  return {
    prefix,
    value,
    suffix,
    decimals: dot === -1 ? 0 : rawNumber.length - dot - 1,
    grouped: rawNumber.includes(","),
  };
}

function formatDisplay(parsed: ParsedDisplay, latest: number): string {
  const number = latest.toLocaleString("en-US", {
    minimumFractionDigits: parsed.decimals,
    maximumFractionDigits: parsed.decimals,
    useGrouping: parsed.grouped,
  });
  return `${parsed.prefix}${number}${parsed.suffix}`;
}
