"use client";

import { useEffect, useState } from "react";
import {
  ChevronDown,
  Clock3,
  Layers3,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  Target
} from "lucide-react";

type Recommendation = {
  id: string;
  title: string;
  summary: string;
  technologies: string[];
  requirements: string[];
  milestones: string[];
  success_criteria: string[];
  estimated_minutes: number;
  difficulty: "BASIC" | "STANDARD" | "ADVANCED";
  rationale: string;
  skill_details?: Array<{ id: string; slug: string; name: string }>;
};

export function ProjectRecommendations() {
  const [items, setItems] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/projects/recommendations", { cache: "no-store" });
      const payload = await response.json();
      if (response.ok && payload.ok) {
        setItems(payload.data.recommendations ?? []);
      }
    } catch {
      // Manual project evidence remains usable even if recommendations fail.
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
      const response = await fetch("/api/projects/recommendations", { method: "POST" });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setMessage(payload.error?.message ?? "Could not generate recommendations.");
        return;
      }

      setItems(payload.data.recommendations ?? []);
      setMessage("Recommendations refreshed from your latest role gaps.");
    } catch {
      setMessage("Could not generate recommendations.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <section className="surface-card mt-7 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700">
            <Sparkles className="size-3.5" />
            Gap-driven projects
          </div>
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">Build evidence that closes a real gap</h2>
          <p className="mt-1.5 text-sm leading-6 text-slate-500">
            These are learning projects generated from your latest target-role gap snapshot, not generic portfolio filler.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={generating}
          className="btn-secondary"
        >
          {generating ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          {generating ? "Generating" : items.length ? "Refresh ideas" : "Generate ideas"}
        </button>
      </div>

      {message ? <p className="mx-5 mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 sm:mx-6">{message}</p> : null}

      {loading ? (
        <div className="grid gap-4 p-5 lg:grid-cols-3 sm:p-6">
          {[0, 1, 2].map(item => (
            <div key={item} className="rounded-xl border border-slate-200 p-5">
              <div className="skeleton h-5 w-24 rounded-lg" />
              <div className="skeleton mt-4 h-6 w-4/5 rounded-lg" />
              <div className="skeleton mt-3 h-4 w-full rounded-lg" />
              <div className="skeleton mt-2 h-4 w-3/4 rounded-lg" />
              <div className="skeleton mt-5 h-9 w-32 rounded-xl" />
            </div>
          ))}
        </div>
      ) : items.length ? (
        <div className="grid gap-4 p-5 lg:grid-cols-3 sm:p-6">
          {items.map(item => (
            <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 transition duration-200 hover:-translate-y-px hover:border-brand-200 hover:shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <span className={"rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] " + difficultyTone(item.difficulty)}>
                  {item.difficulty}
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-500">
                  <Clock3 className="size-3" />
                  {formatMinutes(item.estimated_minutes)}
                </span>
              </div>

              <h3 className="mt-3 text-lg font-semibold tracking-tight text-slate-950">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.summary}</p>

              {item.skill_details?.length ? (
                <div className="mt-4">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    <Target className="size-3.5" />
                    Evidence targets
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.skill_details.map(skill => (
                      <span key={skill.id} className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-700">
                        {skill.name}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <details className="group mt-5 border-t border-slate-100 pt-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-700">
                  Project plan
                  <ChevronDown className="size-4 text-slate-400 transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-4 space-y-4 text-sm text-slate-600">
                  <PlanList icon={Layers3} title="Requirements" items={item.requirements} ordered={false} />
                  <PlanList icon={Target} title="Milestones" items={item.milestones} ordered />
                  <PlanList icon={Sparkles} title="Success criteria" items={item.success_criteria} ordered={false} />
                </div>
              </details>

              <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">{item.rationale}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="p-5 sm:p-6">
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-5 py-8 text-center">
            <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-white text-brand-600 shadow-sm">
              <Sparkles className="size-4.5" />
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-800">No gap-driven ideas yet</p>
            <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">
              Generate recommendations after your target role and latest gap snapshot are available.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function PlanList({
  icon: Icon,
  title,
  items,
  ordered
}: {
  icon: typeof Target;
  title: string;
  items: string[];
  ordered: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 font-semibold text-slate-800">
        <Icon className="size-3.5 text-brand-500" />
        {title}
      </div>
      {ordered ? (
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-xs leading-5">
          {items.map((value, index) => <li key={index}>{value}</li>)}
        </ol>
      ) : (
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs leading-5">
          {items.map((value, index) => <li key={index}>{value}</li>)}
        </ul>
      )}
    </div>
  );
}

function difficultyTone(difficulty: Recommendation["difficulty"]) {
  if (difficulty === "ADVANCED") return "bg-rose-50 text-rose-700";
  if (difficulty === "STANDARD") return "bg-amber-50 text-amber-700";
  return "bg-emerald-50 text-emerald-700";
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return minutes + "m";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? hours + "h " + rest + "m" : hours + "h";
}
