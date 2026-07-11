"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Loader2, X } from "lucide-react";

export type ToastType = "success" | "error" | "loading";

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toast: (options: Omit<ToastMessage, "id">) => string;
  dismiss: (id: string) => void;
  success: (message: string, title?: string) => string;
  error: (message: string, title?: string) => string;
  loading: (message: string, title?: string) => string;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ type, title, message, duration = 4000 }: Omit<ToastMessage, "id">) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, type, title, message, duration }]);

      if (type !== "loading" && duration > 0) {
        setTimeout(() => {
          dismiss(id);
        }, duration);
      }

      return id;
    },
    [dismiss]
  );

  const success = useCallback(
    (message: string, title?: string) => toast({ type: "success", title, message }),
    [toast]
  );

  const error = useCallback(
    (message: string, title?: string) => toast({ type: "error", title, message }),
    [toast]
  );

  const loading = useCallback(
    (message: string, title?: string) => toast({ type: "loading", title, message, duration: 0 }),
    [toast]
  );

  return (
    <ToastContext.Provider value={{ toast, dismiss, success, error, loading }}>
      {children}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

function ToastContainer({
  toasts,
  dismiss,
}: {
  toasts: ToastMessage[];
  dismiss: (id: string) => void;
}) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-3 p-4 rounded-lg border shadow-lg backdrop-blur-md transition-all duration-300 transform translate-y-0 animate-in slide-in-from-bottom-4 pointer-events-auto ${
            t.type === "success"
              ? "bg-white/90 dark:bg-zinc-900/90 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300"
              : t.type === "error"
              ? "bg-white/90 dark:bg-zinc-900/90 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300"
              : "bg-white/90 dark:bg-zinc-900/90 border-violet-200 dark:border-violet-900 text-violet-800 dark:text-violet-300"
          }`}
          role="alert"
        >
          <div className="flex-shrink-0 mt-0.5">
            {t.type === "success" && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
            {t.type === "error" && <AlertCircle className="h-5 w-5 text-rose-500" />}
            {t.type === "loading" && <Loader2 className="h-5 w-5 text-violet-500 animate-spin" />}
          </div>
          <div className="flex-grow">
            {t.title && <p className="font-semibold text-sm leading-5">{t.title}</p>}
            <p className="text-sm opacity-90 leading-relaxed mt-0.5">{t.message}</p>
          </div>
          <button
            onClick={() => dismiss(t.id)}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
