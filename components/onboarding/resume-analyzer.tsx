"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, FileText, LoaderCircle, ShieldCheck, UploadCloud } from "lucide-react";

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

const analysisHints = [
  "Reading your experience and project evidence",
  "Mapping evidence to SkillTwin's canonical skills",
  "Comparing your current state with the target role",
  "Preparing the gaps that will shape your roadmap"
];

export function ResumeAnalyzer({
  onAnalysisComplete
}: {
  onAnalysisComplete?: (summary: { readiness?: number; evidenceCoverage?: number; claims?: number }) => void;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<"idle" | "uploading" | "analyzing" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<AnalysisResponse["data"]>();
  const [hintIndex, setHintIndex] = useState(0);

  useEffect(() => {
    if (stage !== "analyzing") return;
    const timer = window.setInterval(() => {
      setHintIndex(value => (value + 1) % analysisHints.length);
    }, 1900);
    return () => window.clearInterval(timer);
  }, [stage]);

  async function run() {
    if (!file) return;
    setMessage("");
    setResult(undefined);
    setHintIndex(0);
    setStage("uploading");

    try {
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
      onAnalysisComplete?.({
        readiness: analyzed.data?.result?.gapAnalysis?.readiness,
        evidenceCoverage: analyzed.data?.result?.gapAnalysis?.evidenceCoverage,
        claims: analyzed.data?.result?.claims
      });
    } catch {
      setStage("error");
      setMessage("We could not finish the resume analysis. Your last valid SkillTwin state is unchanged.");
    }
  }

  const analysis = result?.result;
  const busy = stage === "uploading" || stage === "analyzing";

  return (
    <section className="surface-card overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <FileText className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold tracking-tight text-slate-950">Add resume evidence</h2>
            <p className="mt-0.5 text-sm text-slate-500">PDF only · stored privately · evidence remains traceable</p>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {!busy && stage !== "done" ? (
          <>
            <label
              htmlFor="resume-upload"
              className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-5 py-8 text-center transition duration-200 hover:border-brand-300 hover:bg-brand-50/40"
            >
              <span className="flex size-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition group-hover:border-brand-200 group-hover:text-brand-600">
                <UploadCloud className="size-5" />
              </span>
              <span className="mt-3 text-sm font-semibold text-slate-800">
                {file ? file.name : "Choose your resume PDF"}
              </span>
              <span className="mt-1 text-xs text-slate-500">
                {file ? formatBytes(file.size) : "Select a text-based PDF up to the configured upload limit"}
              </span>
              <input
                id="resume-upload"
                className="sr-only"
                type="file"
                accept="application/pdf,.pdf"
                onChange={event => setFile(event.target.files?.[0] ?? null)}
              />
            </label>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <ShieldCheck className="size-4 text-emerald-600" />
                Private upload. Skill conclusions are made only through the Evidence Engine.
              </div>
              <button className="btn-primary" disabled={!file} onClick={run}>
                Analyze resume <ArrowRight className="size-4" />
              </button>
            </div>
          </>
        ) : null}

        {busy ? (
          <div className="soft-pop py-3">
            <div className="mx-auto flex max-w-xl flex-col items-center text-center">
              <div className="twin-loader">
                <span className="absolute inset-[28px] z-10 rounded-full bg-brand-500" />
              </div>
              <p className="eyebrow mt-5">{stage === "uploading" ? "Secure upload" : "Building your SkillTwin"}</p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                {stage === "uploading" ? "Uploading your resume…" : "Turning your experience into evidence"}
              </h3>
              <p className="mt-2 min-h-10 text-sm leading-6 text-slate-500">
                {stage === "uploading"
                  ? "Your PDF is being stored privately before any analysis begins."
                  : analysisHints[hintIndex]}
              </p>
            </div>

            <div className="mx-auto mt-7 grid max-w-2xl gap-2 sm:grid-cols-2">
              <ProgressStep
                done={stage === "analyzing"}
                active={stage === "uploading"}
                title="Resume uploaded"
                detail="Private document storage"
              />
              <ProgressStep
                done={false}
                active={stage === "analyzing"}
                title="Evidence analysis"
                detail="Skills, gaps and roadmap context"
              />
            </div>
          </div>
        ) : null}

        {stage === "error" ? (
          <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">
            <p className="font-semibold">Analysis could not finish</p>
            <p className="mt-1">{message}</p>
          </div>
        ) : null}

        {stage === "done" && analysis ? (
          <div className="soft-pop space-y-5">
            <div className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50/80 p-4">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
              <div>
                <p className="font-semibold text-emerald-900">Your SkillTwin is ready</p>
                <p className="mt-1 text-sm text-emerald-800">
                  Resume evidence was accepted through the canonical Evidence Engine and your role analysis was refreshed.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Mapped claims" value={String(analysis.claims ?? 0)} />
              <Stat label="Readiness" value={analysis.gapAnalysis?.readiness != null ? analysis.gapAnalysis.readiness + "%" : "—"} />
              <Stat label="Evidence coverage" value={analysis.gapAnalysis?.evidenceCoverage != null ? analysis.gapAnalysis.evidenceCoverage + "%" : "—"} />
            </div>

            {analysis.evidence?.deltas?.length ? (
              <div>
                <h3 className="text-sm font-semibold text-slate-900">What SkillTwin learned</h3>
                <div className="mt-3 space-y-2">
                  {analysis.evidence.deltas.slice(0, 5).map((delta, index) => (
                    <div key={index} className="flex gap-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 text-sm text-slate-600">
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-brand-400" />
                      <span>{delta.learnerExplanation ?? "Skill state updated from resume evidence."}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <button className="btn-primary" onClick={() => router.push("/overview")}>
              Open my SkillTwin <ArrowRight className="size-4" />
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ProgressStep({
  done,
  active,
  title,
  detail
}: {
  done: boolean;
  active: boolean;
  title: string;
  detail: string;
}) {
  return (
    <div className={"flex items-center gap-3 rounded-xl border p-3.5 transition " + (active ? "border-brand-200 bg-brand-50/70" : "border-slate-200 bg-white")}>
      <span
        className={
          "flex size-8 shrink-0 items-center justify-center rounded-lg " +
          (done ? "bg-emerald-50 text-emerald-600" : active ? "bg-white text-brand-600 shadow-sm" : "bg-slate-100 text-slate-400")
        }
      >
        {done ? <CheckCircle2 className="size-4.5" /> : active ? <LoaderCircle className="size-4.5 animate-spin" /> : <span className="size-2 rounded-full bg-current" />}
      </span>
      <div className="min-w-0 text-left">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <p className="mt-0.5 text-xs text-slate-500">{detail}</p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
