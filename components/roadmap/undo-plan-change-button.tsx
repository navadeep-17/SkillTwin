"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function UndoPlanChangeButton({ diffId }: { diffId: string }) {
  const router = useRouter();
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

  return (
    <div>
      <button
        type="button"
        onClick={undo}
        disabled={pending}
        className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 disabled:opacity-50"
      >
        {pending ? "Undoing safely…" : "Undo this change"}
      </button>
      {message ? <p className="mt-2 max-w-sm text-sm text-rose-700">{message}</p> : null}
    </div>
  );
}
