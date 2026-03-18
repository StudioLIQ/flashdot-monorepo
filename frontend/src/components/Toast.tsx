"use client";

import { useEffect, useState } from "react";

export type ToastTone = "success" | "error" | "info";

export interface ToastModel {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  durationMs?: number;
}

interface ToastProps {
  toast: ToastModel;
  onClose: (id: string) => void;
}

const TOAST_TONE_CLASS: Record<ToastTone, string> = {
  success: "border-neon/60 bg-neon/15 text-ink dark:bg-emerald-950/70 dark:text-white",
  error: "border-red-400/60 bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-100",
  info: "border-ink/20 bg-white/90 text-ink dark:border-white/20 dark:bg-slate-900 dark:text-white",
};

export function Toast({ toast, onClose }: ToastProps): JSX.Element {
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!toast.durationMs || toast.durationMs <= 0) return;
    const timer = setTimeout(() => {
      setClosing(true);
    }, toast.durationMs);

    return () => clearTimeout(timer);
  }, [toast.durationMs]);

  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => onClose(toast.id), 200);
    return () => clearTimeout(timer);
  }, [closing, onClose, toast.id]);

  return (
    <div
      role="status"
      className={`w-full rounded-xl border px-4 py-3 shadow-lg ${TOAST_TONE_CLASS[toast.tone]} ${closing ? "animate-toast-out" : "animate-toast-in"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{toast.title}</p>
          {toast.description ? <p className="mt-1 text-xs opacity-85">{toast.description}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => setClosing(true)}
          className="rounded-md border border-current/25 px-2 py-1 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/10"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
