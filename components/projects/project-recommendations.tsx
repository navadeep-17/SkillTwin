"use client";

import { useEffect, useState } from "react";

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
    <section className="mt-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Gap-driven projects</p>
          <h2 className="mt-1 text-2xl font-semibold">Build evidence that matters</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            These ideas are generated from your latest target-role gap snapshot. They are learning projects, not generic portfolio filler.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={generating}
          className="rounded-xl border border-brand-300 bg-white px-4 py-2 text-sm font-semibold text-brand-700 disabled:opacity-50"
        >
          {generating ? "Generating…" : items.length ? "Refresh ideas" : "Generate project ideas"}
        </button>
      </div>

      {message ? <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{message}</p> : null}

      {loading ? (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
          Loading recommendations…
        </div>
      ) : items.length ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {items.map(item => (
            <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{item.difficulty}</p>
                  <h3 className="mt-1 text-lg font-semibold">{item.title}</h3>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">
                  {Math.round(item.estimated_minutes / 60)}h
                </span>
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-600">{item.summary}</p>

              {item.skill_details?.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {item.skill_details.map(skill => (
                    <span key={skill.id} className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs text-indigo-700">
                      {skill.name}
                    </span>
                  ))}
                </div>
              ) : null}

              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-slate-700">Project plan</summary>
                <div className="mt-3 space-y-4 text-sm text-slate-600">
                  <div>
                    <p className="font-medium text-slate-800">Requirements</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {item.requirements.map((value, index) => <li key={index}>{value}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">Milestones</p>
                    <ol className="mt-1 list-decimal space-y-1 pl-5">
                      {item.milestones.map((value, index) => <li key={index}>{value}</li>)}
                    </ol>
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">Success criteria</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {item.success_criteria.map((value, index) => <li key={index}>{value}</li>)}
                    </ul>
                  </div>
                </div>
              </details>

              <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">{item.rationale}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
          Generate recommendations after your profile and role gaps are available.
        </div>
      )}
    </section>
  );
}
