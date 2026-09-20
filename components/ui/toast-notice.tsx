"use client";

import { useEffect } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

export type ToastMessage = {
  id: number;
  tone: "success" | "error";
  title: string;
  detail?: string;
};

export function ToastNotice({
  toast,
  onDismiss
}: {
  toast: ToastMessage | null;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => onDismiss(toast.id), 3200);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const success = toast.tone === "success";
  const Icon = success ? CheckCircle2 : AlertCircle;

  return (
    <div className="fixed bottom-20 right-4 z-[70] w-[calc(100%-2rem)] max-w-sm lg:bottom-5" aria-live="polite">
      <div
        className={
          "toast-enter flex items-start gap-3 rounded-2xl border bg-white/96 p-4 shadow-lift backdrop-blur " +
          (success ? "border-emerald-100" : "border-rose-100")
        }
        role={success ? "status" : "alert"}
      >
        <span className={"mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl " + (success ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{toast.title}</p>
          {toast.detail ? <p className="mt-1 text-xs leading-5 text-slate-500">{toast.detail}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Dismiss notification"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
