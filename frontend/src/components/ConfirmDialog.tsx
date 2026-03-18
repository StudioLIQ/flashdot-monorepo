"use client";

import { useEffect, useRef } from "react";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  cancelLabel?: string;
  confirmLabel: string;
  confirmTone?: "primary" | "destructive";
  onConfirm: () => void;
  loading?: boolean;
  children?: React.ReactNode;
}

export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  cancelLabel = "Cancel",
  confirmLabel,
  confirmTone = "primary",
  onConfirm,
  loading = false,
  children,
}: ConfirmDialogProps): JSX.Element | null {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus cancel button when dialog opens
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => cancelRef.current?.focus(), 20);
    return () => clearTimeout(timer);
  }, [open]);

  // ESC to close + focus trap
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape" && !loading) {
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first && last) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last && first) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, loading, onClose]);

  if (!open) return null;

  return (
    <div
      className="animate-dialog-backdrop fixed inset-0 z-40 flex items-end bg-ink/55 px-4 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm sm:grid sm:place-items-center dark:bg-slate-950/70"
      aria-hidden="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="elevation-3 animate-dialog-enter w-full max-w-md rounded-t-2xl p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-dialog-title" className="text-lg font-semibold">
          {title}
        </h3>
        {description ? (
          <p className="mt-2 text-sm text-ink/75 dark:text-white/75">{description}</p>
        ) : null}
        {children ? <div className="mt-4">{children}</div> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-ink/20 px-3 py-2 text-sm font-semibold hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:hover:bg-white/10"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
              confirmTone === "destructive"
                ? "bg-danger text-white hover:bg-danger/90"
                : "bg-primary text-primary-fg hover:bg-primary-hover"
            }`}
          >
            {loading ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
