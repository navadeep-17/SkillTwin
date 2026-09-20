"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Clock3, RefreshCw, Sparkles, Target, TrendingUp } from "lucide-react";

type Report = {
  id: string;
  week_start: string;
  week_end: string;
  readiness_start: number | null;
  readiness_end: number | null;
  tasks_completed: number;
  learning_minutes: number;
  assessments_completed: number;
  skills_changed: number;
  roadmap_changes: number;
  summary: string;
  recommended_next_step: string | null;
};

export function WeeklyReportCard() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const response = await fetch("/api/progress/weekly-report", { cache: "no-store" });
      const payload = await response.json();
      if (response.ok && payload.ok) setReport(payload.data.report ?? null);
    } catch {
      // Progress page remains useful if the report endpoint is unavailable.
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function generate() {
    setGenerating(true);
    setMessage("");
    try {
      const response = await fetch("/api/progress/weekly-report", { method: "POST" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setMessage(payload.error?.message ?? "Could not generate the report.");
        return;
      }
      setReport(payload.data.report);
      setMessage("Weekly report refreshed from current canonical state.");
    } catch {
      setMessage("Could not generate the report.");
    } finally {
      setGenerating(false);
    }
  }

  const readinessDelta = report?.readiness_start != null && report?.readiness_end != null
    ? Number(report.readiness_end) - Number(report.readiness_start)
    : null;

  return (
    <section className="surface-card mt-6 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <CalendarDays className="size-4.5" />
            </span>
            <div>
              <p className="eyebrow">Weekly report</p>
              <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-950">What changed this week</h2>
            </div>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
            Activity and validated capability stay separate: completed work is counted, but only accepted evidence can change readiness.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={generating}
          className="btn-secondary"
        >
          <RefreshCw className={"size-4 " + (generating ? "animate-spin" : "")} />
          {generating ? "Refreshing" : report ? "Refresh report" : "Generate report"}
        </button>
      </div>

      {loading ? (
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5 sm:p-6">
          {[0,1,2,3,4].map(item => <div key={item} className="skeleton h-20 rounded-xl" />)}
        </div>
      ) : report ? (
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{new Date(report.week_start + "T00:00:00").toLocaleDateString()}</span>
            <span>→</span>
            <span>{new Date(report.week_end + "T00:00:00").toLocaleDateString()}</span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <MiniMetric icon={TrendingUp} label="Readiness" value={readinessDelta == null ? "—" : (readinessDelta >= 0 ? "+" : "") + readinessDelta + " pts"} />
            <MiniMetric icon={Target} label="Tasks" value={String(report.tasks_completed)} />
            <MiniMetric icon={Clock3} label="Learning time" value={formatMinutes(report.learning_minutes)} />
            <MiniMetric icon={Sparkles} label="Validations" value={String(report.assessments_completed)} />
            <MiniMetric icon={RefreshCw} label="Skill changes" value={String(report.skills_changed)} />
          </div>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-sm leading-6 text-slate-700">{report.summary}</p>
            {report.recommended_next_step ? (
              <p className="mt-3 text-sm font-medium leading-6 text-slate-900">
                Next: {report.recommended_next_step}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="p-5 sm:p-6">
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-5 py-7 text-center">
            <p className="text-sm font-semibold text-slate-800">No weekly report yet</p>
            <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">
              Generate one after you have started learning or validating skills.
            </p>
          </div>
        </div>
      )}

      {message ? <p className="mx-5 mb-5 rounded-xl bg-slate-50 p-3 text-sm text-slate-600 sm:mx-6">{message}</p> : null}
    </section>
  );
}

function MiniMetric({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Target;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className="size-4" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-2 text-lg font-semibold tracking-tight text-slate-950">{value}</p>
    </div>
  );
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return minutes + "m";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? hours + "h " + rest + "m" : hours + "h";
}
