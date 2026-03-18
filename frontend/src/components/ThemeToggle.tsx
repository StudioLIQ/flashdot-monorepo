"use client";

import { useTheme } from "../providers/ThemeProvider";

interface ThemeToggleProps {
  className?: string;
}

function SunIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.7 4.7l1.5 1.5M17.8 17.8l1.5 1.5M2.5 12h2.2M19.3 12h2.2M4.7 19.3l1.5-1.5M17.8 6.2l1.5-1.5" />
    </svg>
  );
}

function MoonIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M19.6 14.7A8.7 8.7 0 1 1 9.3 4.4a7 7 0 1 0 10.3 10.3Z" />
    </svg>
  );
}

export function ThemeToggle({ className }: ThemeToggleProps): JSX.Element {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={`grid min-h-11 min-w-11 place-items-center rounded-xl border border-ink/15 bg-white/80 text-ink transition hover:bg-white dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15 ${className ?? ""}`}
    >
      <span className={`transition-transform duration-300 ${theme === "dark" ? "rotate-0" : "rotate-180"}`}>
        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      </span>
    </button>
  );
}
