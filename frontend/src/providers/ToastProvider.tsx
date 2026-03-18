"use client";

import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { Toast, ToastModel, ToastTone } from "../components/Toast";

interface ShowToastInput {
  tone: ToastTone;
  title: string;
  description?: string;
  durationMs?: number;
}

interface ToastContextValue {
  showToast: (input: ShowToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function defaultDuration(tone: ToastTone): number {
  if (tone === "error") return 12_000; // longer for error — user needs to read
  return 4_000;
}

export function ToastProvider({ children }: PropsWithChildren): JSX.Element {
  const [toasts, setToasts] = useState<ToastModel[]>([]);

  const showToast = useCallback((input: ShowToastInput) => {
    const toast: ToastModel = {
      id: crypto.randomUUID(),
      tone: input.tone,
      title: input.title,
      ...(input.description ? { description: input.description } : {}),
      ...(input.durationMs !== undefined
        ? { durationMs: input.durationMs }
        : { durationMs: defaultDuration(input.tone) }),
    };

    setToasts((prev) => [
      ...prev,
      toast,
    ]);
  }, []);

  const closeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
    }),
    [showToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-3">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast toast={toast} onClose={closeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }

  return context;
}
