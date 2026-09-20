"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, RotateCcw } from "lucide-react";

export function UndoPlanChangeButton({ diffId }: { diffId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function undo() {
    setPending(true);
    setMessage("");

    try {
      const response = await fetch("/api/roadmap/diffs/" + diffId + "/undo", {
        method: "POST"
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setMessage(payload.error?.message ?? "Could not undo this change.");
        return;
      }

      router.push("/roadmap");
      router.refresh();
    } catch {
      setMessage("Could not undo this change.");
    } finally {
      setPending(false);
    }
  }

  if (confirming) {
    return (
      <div className="soft-pop rounded-xl border border-amber-200 bg-amber-50 p-3">
        <p className="text-xs font-semibold text-amber-900">Create a rollback plan version?</p>
        <p className="mt-1 max-w-sm text-xs leading-5 text-amber-800">
          History will stay intact. SkillTwin will restore the prior plan intent through a new version.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
            {pending ? "Rolling back" : "Confirm undo"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={pending}
            className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 disabled:opacity-50"
          >
            Keep current plan
          </button>
        </div>
        {message ? <p className="mt-2 text-xs text-rose-700">{message}</p> : null}
      </div>
    );
  }

  return (
    <button type="button" onClick={() => setConfirming(true)} className="btn-secondary">
      <RotateCcw className="size-4" />
      Undo this change
    </button>
  );
}
