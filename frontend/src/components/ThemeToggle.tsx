"use client";

import { useTheme } from "../providers/ThemeProvider";

export function ThemeToggle(): JSX.Element {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="rounded-xl border border-ink/15 bg-white/80 px-4 py-2 text-sm font-semibold text-ink transition hover:bg-white dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
    >
      {theme === "dark" ? "Light Mode" : "Dark Mode"}
    </button>
  );
}
