"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { getToastEventName, ToastPayload } from "@/lib/toast";

interface ToastItem extends Required<Pick<ToastPayload, "title">> {
  id: string;
  type: "success" | "error" | "info";
  description?: string;
  durationMs: number;
}

const typeStyles: Record<ToastItem["type"], string> = {
  success:
    "border-emerald-300/80 bg-emerald-50 text-emerald-900 dark:border-emerald-700/70 dark:bg-emerald-950/60 dark:text-emerald-100",
  error:
    "border-rose-300/80 bg-rose-50 text-rose-900 dark:border-rose-700/70 dark:bg-rose-950/60 dark:text-rose-100",
  info:
    "border-sky-300/80 bg-sky-50 text-sky-900 dark:border-sky-700/70 dark:bg-sky-950/60 dark:text-sky-100"
};

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<ToastPayload>;
      const payload = custom.detail;
      if (!payload?.title) return;
      const toast: ToastItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        title: payload.title,
        description: payload.description,
        type: payload.type ?? "info",
        durationMs: payload.durationMs ?? 4200
      };
      setToasts((prev) => [...prev, toast].slice(-4));

      window.setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== toast.id));
      }, toast.durationMs);
    };

    window.addEventListener(getToastEventName(), handler as EventListener);
    return () => window.removeEventListener(getToastEventName(), handler as EventListener);
  }, []);

  const hasToasts = useMemo(() => toasts.length > 0, [toasts.length]);
  if (!hasToasts) return null;

  return (
    <div className="pointer-events-none fixed left-3 right-3 top-3 z-[70] flex w-auto flex-col gap-2 sm:left-auto sm:right-4 sm:top-4 sm:w-full sm:max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto rounded-xl border px-4 py-3 shadow-lg backdrop-blur",
            typeStyles[toast.type]
          )}
        >
          <p className="text-sm font-semibold">{toast.title}</p>
          {toast.description ? <p className="mt-1 text-xs opacity-90">{toast.description}</p> : null}
        </div>
      ))}
    </div>
  );
}
