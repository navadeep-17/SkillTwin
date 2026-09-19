"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type ResourceAssignment = {
  learning_resources?: {
    id?: string;
    title?: string;
    provider?: string;
    url?: string;
    format?: string;
    duration_minutes?: number | null;
    quality?: number;
  } | null;
  explanation?: string;
};

type Task = {
  id: string;
  type: "LEARN" | "PRACTICE" | "BUILD" | "VALIDATE";
  title: string;
  duration_minutes: number;
  due_at: string | null;
  status: string;
  difficulty: string;
  flexible: boolean;
  rationale_code: string;
  resource?: ResourceAssignment | null;
};

type Objective = {
  id: string;
  type: string;
  success_criteria: string;
  target_score: number;
  skills?: { canonical_name?: string; category?: string } | null;
  tasks: Task[];
};

type Week = {
  id: string;
  week_index: number;
  start_date: string;
  end_date: string;
  capacity_minutes: number;
  planned_minutes: number;
  rationale?: string | null;
  objectives: Objective[];
};

type RoadmapPayload = {
  ok: boolean;
  data?: {
    plan: null | {
      id: string;
      version: number;
      start_date: string;
      end_date: string;
      planned_minutes: number;
      adaptation_buffer_minutes: number;
      planner_version: string;
      warnings: string[];
      weeks: Week[];
    };
  };
  error?: { message?: string };
};

export function RoadmapView() {
  const router = useRouter();
  const [payload, setPayload] = useState<RoadmapPayload | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/roadmap", { cache: "no-store" })
      .then(response => response.json())
      .then(data => {
        if (active) setPayload(data);
      })
      .catch(() => {
        if (active) setPayload({ ok: false, error: { message: "Could not load roadmap." } });
      });
    return () => {
      active = false;
    };
  }, [revision]);

  if (!payload) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading roadmap…</div>;
  }

  if (!payload.ok) {
    return <div className="rounded-2xl bg-rose-50 p-5 text-sm text-rose-700">{payload.error?.message ?? "Could not load roadmap."}</div>;
  }

  const plan = payload.data?.plan;
  if (!plan) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">No active roadmap yet</h2>
        <p className="mt-2 text-slate-600">Analyze your resume first, then SkillTwin can generate Plan v1.</p>
        <Link href="/onboarding" className="mt-5 inline-flex rounded-xl bg-brand-600 px-4 py-2 font-medium text-white">
          Analyze profile
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Plan version" value={"v" + plan.version} />
        <Metric label="Weeks" value={String(plan.weeks.length)} />
        <Metric label="Planned time" value={formatMinutes(plan.planned_minutes)} />
        <Metric label="Adaptation buffer" value={formatMinutes(plan.adaptation_buffer_minutes) + "/week"} />
      </section>

      {plan.warnings?.length ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {plan.warnings.join(" · ")}
        </div>
      ) : null}

      <div className="space-y-5">
        {plan.weeks.map(week => {
          const percent = Math.min(100, Math.round(100 * week.planned_minutes / Math.max(week.capacity_minutes, 1)));
          return (
            <section key={week.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Week {week.week_index}</p>
                  <h2 className="mt-1 text-xl font-semibold">{week.start_date} → {week.end_date}</h2>
                  <p className="mt-1 text-sm text-slate-500">{week.rationale}</p>
                </div>
                <div className="min-w-44 text-right">
                  <p className="text-sm font-medium">{week.planned_minutes} / {week.capacity_minutes} min</p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand-600" style={{ width: percent + "%" }} />
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-5">
                {week.objectives.map(objective => (
                  <div key={objective.id}>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{objective.skills?.canonical_name ?? "Skill objective"}</h3>
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">{objective.type}</span>
                    </div>
                    <p className="mb-3 text-sm text-slate-500">{objective.success_criteria}</p>
                    <div className="grid gap-3 md:grid-cols-2">
                      {objective.tasks.map(task => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onChanged={() => setRevision(value => value + 1)}
                          onOpen={(href) => router.push(href)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function TaskCard({
  task,
  onChanged,
  onOpen
}: {
  task: Task;
  onChanged: () => void;
  onOpen: (href: string) => void;
}) {
  const resource = task.resource?.learning_resources;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function act() {
    if (pending || task.status === "COMPLETED") return;
    setPending(true);
    setError("");

    try {
      const validation = task.type === "VALIDATE";
      const response = await fetch(
        "/api/tasks/" + task.id + (validation ? "/validate" : "/complete"),
        { method: "POST" }
      );
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setError(payload.error?.message ?? "Could not update this task.");
        return;
      }

      if (validation) {
        const href = payload.ui_effects?.next_action?.href;
        if (href) onOpen(href);
        return;
      }

      onChanged();
    } catch {
      setError("Could not update this task.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{task.type}</p>
          <p className="mt-1 font-medium">{task.title}</p>
        </div>
        <span className="rounded-full bg-white px-2 py-1 text-xs text-slate-600">{task.duration_minutes} min</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
        <span>{task.difficulty}</span>
        {task.due_at ? <span>{new Date(task.due_at).toLocaleDateString()}</span> : null}
        {task.flexible ? <span>Flexible</span> : null}
      </div>
      {resource?.url ? (
        <a
          href={resource.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 block rounded-lg border border-slate-200 bg-white p-3 text-sm hover:border-brand-300"
        >
          <span className="font-medium">{resource.title}</span>
          <span className="ml-2 text-slate-500">· {resource.provider}</span>
        </a>
      ) : null}

      <div className="mt-4">
        {task.status === "COMPLETED" ? (
          <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
            Completed
          </span>
        ) : (
          <button
            type="button"
            onClick={act}
            disabled={pending}
            className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            {pending
              ? task.type === "VALIDATE" ? "Preparing…" : "Saving…"
              : task.type === "VALIDATE" ? "Start validation" : "Mark complete"}
          </button>
        )}
        {error ? <p className="mt-2 text-xs text-rose-700">{error}</p> : null}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return minutes + "m";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? hours + "h " + rest + "m" : hours + "h";
}
