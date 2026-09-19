"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AnalysisResponse = {
  ok: boolean;
  data?: {
    result?: {
      quality?: { pageCount?: number; charCount?: number };
      claims?: number;
      evidence?: { deltas?: Array<{ learnerExplanation?: string }> };
      gapAnalysis?: { readiness?: number; evidenceCoverage?: number } | null;
      warnings?: string[];
    };
  };
  error?: { message?: string };
};

export function ResumeAnalyzer() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<"idle" | "uploading" | "analyzing" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<AnalysisResponse["data"]>();

  async function run() {
    if (!file) return;
    setMessage("");
    setResult(undefined);
    setStage("uploading");

    const form = new FormData();
    form.set("file", file);

    const upload = await fetch("/api/profile/documents", { method: "POST", body: form });
    const uploaded = await upload.json();
    if (!upload.ok || !uploaded.ok) {
      setStage("error");
      setMessage(uploaded.error?.message ?? "Upload failed.");
      return;
    }

    const documentId = uploaded.data.document.id as string;
    setStage("analyzing");

    const analyze = await fetch("/api/profile/documents/" + documentId + "/analyze", { method: "POST" });
    const analyzed = await analyze.json() as AnalysisResponse;

    if (!analyze.ok || !analyzed.ok) {
      setStage("error");
      setMessage(analyzed.error?.message ?? "Analysis failed.");
      return;
    }

    setResult(analyzed.data);
    setStage("done");
  }

  const analysis = result?.result;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Resume PDF</span>
        <input
          className="mt-2 block w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm"
          type="file"
          accept="application/pdf,.pdf"
          onChange={event => setFile(event.target.files?.[0] ?? null)}
        />
      </label>

      <button
        className="mt-4 rounded-xl bg-brand-600 px-5 py-2.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!file || stage === "uploading" || stage === "analyzing"}
        onClick={run}
      >
        {stage === "uploading" ? "Uploading securely..." : stage === "analyzing" ? "Analyzing evidence..." : "Analyze resume"}
      </button>

      {stage === "error" ? (
        <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{message}</p>
      ) : null}

      {stage === "done" && analysis ? (
        <div className="mt-6 space-y-4">
          <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
            Resume analysis complete.
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Mapped claims" value={String(analysis.claims ?? 0)} />
            <Stat label="Readiness" value={analysis.gapAnalysis?.readiness != null ? analysis.gapAnalysis.readiness + "%" : "—"} />
            <Stat label="Evidence coverage" value={analysis.gapAnalysis?.evidenceCoverage != null ? analysis.gapAnalysis.evidenceCoverage + "%" : "—"} />
          </div>
          {analysis.evidence?.deltas?.length ? (
            <div>
              <h2 className="font-semibold">What SkillTwin learned</h2>
              <ul className="mt-2 space-y-2 text-sm text-slate-600">
                {analysis.evidence.deltas.slice(0, 6).map((delta, index) => (
                  <li key={index} className="rounded-lg bg-slate-50 p-3">
                    {delta.learnerExplanation ?? "Skill state updated from resume evidence."}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <button
            className="rounded-xl border border-slate-300 px-4 py-2 font-medium"
            onClick={() => router.push("/overview")}
          >
            Open SkillTwin overview
          </button>
        </div>
      ) : null}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
