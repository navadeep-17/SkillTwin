"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ManualProfileEvidence() {
  const router = useRouter();
  const [title, setTitle] = useState("About my skills");
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<{ claims?: number; gapAnalysis?: { readiness?: number } | null } | null>(null);

  async function analyze() {
    if (pending || text.trim().length < 40) return;
    setPending(true);
    setMessage("");
    setResult(null);

    try {
      const response = await fetch("/api/profile/manual-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, text })
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setMessage(payload.error?.message ?? "Could not analyze this profile evidence.");
        return;
      }

      setResult(payload.data);
      setMessage("Manual profile evidence processed.");
      window.dispatchEvent(new Event("skilltwin:profile-analysis-complete"));
      router.refresh();
    } catch {
      setMessage("Could not analyze this profile evidence.");
    } finally {
      setPending(false);
    }
  }

  return (
    <details className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <summary className="cursor-pointer font-semibold">No resume? Add profile evidence manually</summary>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Paste a short description of projects, coursework, internships, or technologies you have actually used.
        SkillTwin still maps only to the canonical catalog and keeps mentions separate from demonstrated usage.
      </p>

      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Source title</span>
          <input
            value={title}
            onChange={event => setTitle(event.target.value)}
            maxLength={120}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Your evidence</span>
          <textarea
            value={text}
            onChange={event => setText(event.target.value)}
            rows={7}
            maxLength={12000}
            placeholder="Example: Built a REST API in JavaScript, wrote SQL queries for reporting, containerized the service with Docker, and tested authentication flows."
            className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm leading-6"
          />
        </label>
        <button
          type="button"
          onClick={() => void analyze()}
          disabled={pending || title.trim().length < 2 || text.trim().length < 40}
          className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Analyzing evidence…" : "Analyze manual evidence"}
        </button>
      </div>

      {message ? (
        <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{message}</p>
      ) : null}

      {result ? (
        <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-600">
          <span>{result.claims ?? 0} mapped claims</span>
          {result.gapAnalysis?.readiness != null ? <span>Readiness {result.gapAnalysis.readiness}%</span> : null}
        </div>
      ) : null}
    </details>
  );
}
