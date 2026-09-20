"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, LoaderCircle, PlayCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export function TaskDetailActions({
  taskId,
  taskType,
  completed,
  stale
}: {
  taskId: string;
  taskType: string;
  completed: boolean;
  stale: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function act() {
    if (pending || completed || stale) return;
    setPending(true);
    setMessage("");

    const validation = taskType === "VALIDATE";

    try {
      const response = await fetch(
        "/api/tasks/" + taskId + (validation ? "/validate" : "/complete"),
        { method: "POST" }
      );
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setMessage(payload.error?.message ?? "Could not update this task.");
        return;
      }

      if (validation) {
        const href = payload.ui_effects?.next_action?.href;
        if (href) {
          router.push(href);
          return;
        }
      }

      setMessage("Task completed.");
      router.refresh();
    } catch {
      setMessage("Could not update this task.");
    } finally {
      setPending(false);
    }
  }

  if (completed) {
    return (
      <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
        <CheckCircle2 className="size-4" />
        Completed
      </div>
    );
  }

  if (stale) {
    return (
      <button type="button" onClick={() => router.push("/roadmap")} className="btn-secondary">
        Open active plan <ArrowRight className="size-4" />
      </button>
    );
  }

  return (
    <div className="min-w-48">
      <button type="button" onClick={() => void act()} disabled={pending} className="btn-primary w-full justify-center">
        {pending
          ? <LoaderCircle className="size-4 animate-spin" />
          : taskType === "VALIDATE"
            ? <PlayCircle className="size-4" />
            : <CheckCircle2 className="size-4" />}
        {pending
          ? taskType === "VALIDATE" ? "Preparing" : "Saving"
          : taskType === "VALIDATE" ? "Start validation" : "Mark complete"}
      </button>
      {message ? <p className="mt-2 text-center text-xs text-slate-500">{message}</p> : null}
    </div>
  );
}
