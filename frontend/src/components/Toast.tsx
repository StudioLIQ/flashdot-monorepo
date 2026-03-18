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
  success: "border-success/60 bg-success/15 text-ink dark:bg-success/20 dark:text-white",
  error: "border-danger/60 bg-danger/10 text-danger dark:bg-danger/20 dark:text-danger",
  info: "border-info/50 bg-info/10 text-ink dark:border-info/35 dark:bg-info/20 dark:text-white",
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
