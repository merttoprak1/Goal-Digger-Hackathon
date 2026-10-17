/**
 * Material Symbols wrapper.
 *
 * The font (and the `material-symbols-outlined` class name) is loaded from
 * Google Fonts in `root.tsx`. `display=block` there keeps the ligature text
 * from flashing before the font arrives.
 */
export function Icon({
  name,
  className = "",
  filled = false,
}: {
  /** Material Symbols name, e.g. `account_balance_wallet`. */
  name: string;
  className?: string;
  /** Use the filled variant of the glyph. */
  filled?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-outlined leading-none ${className}`}
      style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
      {name}
    </span>
  );
}
