"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ProposedPlanChangeActions({ diffId }: { diffId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<"apply" | "reject" | null>(null);
  const [message, setMessage] = useState("");

  async function act(kind: "apply" | "reject") {
    if (pending) return;
    setPending(kind);
    setMessage("");

    try {
      const response = await fetch("/api/roadmap/diffs/" + diffId + "/" + kind, {
        method: "POST"
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setMessage(payload.error?.message ?? "Could not update this roadmap proposal.");
        return;
      }

      router.push("/roadmap");
      router.refresh();
    } catch {
      setMessage("Could not update this roadmap proposal.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void act("apply")}
          disabled={Boolean(pending)}
          className="rounded-xl bg-brand-600 px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {pending === "apply" ? "Applying safely…" : "Apply this change"}
        </button>
        <button
          type="button"
          onClick={() => void act("reject")}
          disabled={Boolean(pending)}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 disabled:opacity-50"
        >
          {pending === "reject" ? "Keeping current plan…" : "Keep current roadmap"}
        </button>
      </div>
      {message ? <p className="mt-2 max-w-lg text-sm text-rose-700">{message}</p> : null}
    </div>
  );
}
