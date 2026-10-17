import { useEffect, useState } from "react";

export const THEME_STORAGE_KEY = "goal-digger-theme";

type Theme = "light" | "dark";

function readInitialTheme(): Theme {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Switches DaisyUI's `data-theme` and remembers the choice. The inline script in
 * `root.tsx` reads the same key so the correct theme is applied before paint.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(readInitialTheme());
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  }

  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      title="Toggle theme"
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
