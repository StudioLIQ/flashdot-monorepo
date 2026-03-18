"use client";

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
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

const TONE_CONFIG: Record<ToastTone, { bar: string; icon: typeof CheckCircle2; iconClass: string; bg: string }> = {
  success: {
    bar: "bg-success",
    icon: CheckCircle2,
    iconClass: "text-success",
    bg: "border-success/40 bg-white dark:bg-slate-900",
  },
  error: {
    bar: "bg-danger",
    icon: AlertCircle,
    iconClass: "text-danger",
    bg: "border-danger/40 bg-white dark:bg-slate-900",
  },
  info: {
    bar: "bg-info",
    icon: Info,
    iconClass: "text-info",
    bg: "border-info/35 bg-white dark:bg-slate-900",
  },
};

export function Toast({ toast, onClose }: ToastProps): JSX.Element {
  const [closing, setClosing] = useState(false);
  const config = TONE_CONFIG[toast.tone];
  const Icon = config.icon;

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
      className={`flex w-full overflow-hidden rounded-xl border shadow-lg ${config.bg} ${closing ? "animate-toast-out" : "animate-toast-in"}`}
    >
      {/* Left accent bar */}
      <div className={`w-1 shrink-0 ${config.bar}`} />

      <div className="flex flex-1 items-start gap-3 px-4 py-3">
        <Icon size={16} className={`mt-0.5 shrink-0 ${config.iconClass}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink dark:text-white">{toast.title}</p>
          {toast.description ? (
            <p className="mt-0.5 text-xs text-ink/70 dark:text-white/65">{toast.description}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setClosing(true)}
          aria-label="Dismiss notification"
          className="shrink-0 rounded-md p-1 text-ink/45 hover:bg-ink/5 dark:text-white/40 dark:hover:bg-white/10"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
