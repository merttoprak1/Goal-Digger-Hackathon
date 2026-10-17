/**
 * Facebook-style placeholder for a user who has not uploaded a photo: a plain
 * person silhouette on a soft grey disc.
 *
 * Drawn inline so it inherits `currentColor`, never depends on the icon font
 * being loaded, and needs no image asset. Size it with `className` (e.g.
 * `h-9 w-9`); the ring and the status dot are the caller's job.
 */
export function Avatar({
  className = "",
  label = "Profile photo",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-slate-200 text-slate-400 ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        className="h-full w-full"
      >
        <circle cx="12" cy="8.6" r="4.1" />
        <path d="M12 14.1c-4.7 0-8.5 3-8.5 6.7V24h17v-3.2c0-3.7-3.8-6.7-8.5-6.7Z" />
      </svg>
    </span>
  );
}
