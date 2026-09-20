"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ChallengeLauncher() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function startChallenge() {
    setPending(true);
    setError("");

    try {
      const response = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "CHALLENGE_ME" })
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setError(payload.error?.message ?? "Could not start Challenge Me.");
        return;
      }

      router.push("/practice/" + payload.data.assessment.id);
    } catch {
      setError("Could not start Challenge Me.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="grid gap-6 md:grid-cols-[1.2fr_.8fr] md:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Active validation</p>
          <h2 className="mt-2 text-2xl font-semibold">Test what matters next</h2>
          <p className="mt-3 text-slate-600">
            SkillTwin selects an assessable target using your latest role gaps, evidence confidence, and the available validated question bank.
          </p>
          {error ? <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
          <button
            type="button"
            onClick={startChallenge}
            disabled={pending}
            className="mt-5 rounded-xl bg-brand-600 px-5 py-2.5 font-medium text-white disabled:opacity-50"
          >
            {pending ? "Preparing challenge…" : "Challenge Me"}
          </button>
        </div>

        <div className="rounded-2xl bg-slate-50 p-5">
          <p className="font-medium">What happens after completion?</p>
          <ol className="mt-3 space-y-2 text-sm text-slate-600">
            <li>1. Assessment outcome is persisted.</li>
            <li>2. One summary evidence item is sent to the Evidence Engine.</li>
            <li>3. Skill capability/confidence may change.</li>
            <li>4. Role gaps and readiness are recomputed.</li>
          </ol>
        </div>
      </div>
    </section>
  );
}
