"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type Kind = "success" | "error" | "info";
type Toast = { id: number; message: string; kind: Kind };

const ToastContext = createContext<(message: string, kind?: Kind) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const push = useCallback((message: string, kind: Kind = "success") => {
    idRef.current += 1;
    const id = idRef.current;
    setToasts((t) => [...t.slice(-2), { id, message, kind }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3200);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex flex-col items-center gap-2 px-4 pb-[env(safe-area-inset-bottom)] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end sm:px-0 sm:pb-0"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`toast-in pointer-events-auto flex min-h-[48px] w-full max-w-sm items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-[0_8px_24px_rgba(0,0,0,0.16)] ${
              t.kind === "error" ? "bg-pale-red-ink text-white" : "bg-ink text-[var(--color-canvas)]"
            }`}
          >
            <span
              aria-hidden="true"
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                t.kind === "error" ? "bg-white/25" : "bg-primary text-on-primary"
              }`}
            >
              {t.kind === "error" ? "!" : t.kind === "info" ? "i" : "✓"}
            </span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
