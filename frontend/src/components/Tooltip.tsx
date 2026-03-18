"use client";

import { HelpCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface TooltipProps {
  content: string;
  children?: React.ReactNode;
  /** Shows a (?) icon when no children are provided */
  icon?: boolean;
}

/**
 * Simple tooltip that works on both desktop (hover) and mobile (tap).
 * Closes on outside click / second tap.
 */
export function Tooltip({ content, children, icon = false }: TooltipProps): JSX.Element {
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!visible) return;
    const handler = (e: MouseEvent | TouchEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setVisible(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [visible]);

  return (
    <span ref={containerRef} className="relative inline-flex items-center gap-0.5">
      {/* Trigger */}
      <span
        role="button"
        tabIndex={0}
        aria-label={`Help: ${content}`}
        aria-expanded={visible}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        onClick={() => setVisible((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setVisible((v) => !v);
          }
          if (e.key === "Escape") setVisible(false);
        }}
        className="cursor-help"
      >
        {children ?? (icon ? (
          <HelpCircle size={13} className="text-ink/45 dark:text-white/40 hover:text-ink/70 dark:hover:text-white/60 transition-colors" />
        ) : null)}
      </span>

      {/* Popover */}
      {visible ? (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-1.5 w-max max-w-[220px] -translate-x-1/2 rounded-xl border border-ink/15 bg-white px-3 py-2 text-xs text-ink shadow-lg dark:border-white/15 dark:bg-slate-900 dark:text-white"
        >
          {content}
          {/* Arrow */}
          <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-white dark:border-t-slate-900" />
        </span>
      ) : null}
    </span>
  );
}

/**
 * Inline term with dotted underline + tooltip.
 * e.g. <TooltipTerm term="Bond">A deposit locked as collateral.</TooltipTerm>
 */
export function TooltipTerm({ term, children }: { term: string; children: string }): JSX.Element {
  return (
    <Tooltip content={children}>
      <span className="cursor-help border-b border-dashed border-ink/35 dark:border-white/30">
        {term}
      </span>
    </Tooltip>
  );
}
