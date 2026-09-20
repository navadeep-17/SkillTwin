"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  ExternalLink,
  LoaderCircle,
  Sparkles
} from "lucide-react";
import { ToastNotice, type ToastMessage } from "@/components/ui/toast-notice";

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
  validation_available?: boolean;
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
  const [optimisticCompleted, setOptimisticCompleted] = useState<Set<string>>(() => new Set());
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const notify = useCallback((tone: ToastMessage["tone"], title: string, detail?: string) => {
    setToast({ id: Date.now(), tone, title, detail });
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToast(current => current?.id === id ? null : current);
  }, []);

  const markOptimistic = useCallback((taskId: string) => {
    setOptimisticCompleted(current => {
      const next = new Set(current);
      next.add(taskId);
      return next;
    });
  }, []);

  const rollbackOptimistic = useCallback((taskId: string) => {
    setOptimisticCompleted(current => {
      const next = new Set(current);
      next.delete(taskId);
      return next;
    });
  }, []);

  useEffect(() => {
    let active = true;

    async function loadRoadmap() {
      try {
        await fetch("/api/roadmap/sync", { method: "POST" }).catch(() => null);
        const response = await fetch("/api/roadmap", { cache: "no-store" });
        const data = await response.json();
        if (active) {
          setPayload(data);
          setOptimisticCompleted(new Set());
        }
      } catch {
        if (active) setPayload({ ok: false, error: { message: "Could not load roadmap." } });
      }
    }

    void loadRoadmap();
    return () => {
      active = false;
    };
  }, [revision]);

  if (!payload) {
    return <RoadmapSkeleton />;
  }

  if (!payload.ok) {
    return (
      <div className="rounded-2xl border border-rose-100 bg-rose-50 p-5 text-sm text-rose-700">
        {payload.error?.message ?? "Could not load roadmap."}
      </div>
    );
  }

  const plan = payload.data?.plan;
  if (!plan) {
    return (
      <div className="surface-card p-7">
        <div className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Sparkles className="size-5" />
        </div>
        <h2 className="mt-4 text-xl font-semibold tracking-tight">No active roadmap yet</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
          Add profile evidence first. SkillTwin will turn your current gaps and constraints into a persistent learning plan.
        </p>
        <Link href="/onboarding" className="btn-primary mt-5">
          Build my plan <ArrowRight className="size-4" />
        </Link>
      </div>
    );
  }

  const completedTasks = plan.weeks
    .flatMap(week => week.objectives.flatMap(objective => objective.tasks))
    .filter(task => task.status === "COMPLETED" || optimisticCompleted.has(task.id)).length;
  const totalTasks = plan.weeks.reduce(
    (total, week) => total + week.objectives.reduce((sum, objective) => sum + objective.tasks.length, 0),
    0
  );
  const completion = totalTasks ? Math.round(100 * completedTasks / totalTasks) : 0;

  return (
    <div className="space-y-6">
      <section className="surface-card hero-wash relative overflow-hidden p-6 sm:p-7">
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow">Active plan · v{plan.version}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              {plan.weeks.length} weeks of focused work
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Your roadmap preserves adaptation capacity so SkillTwin can react to new evidence without rebuilding everything.
            </p>
          </div>
          <div className="min-w-52">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Plan progress</span>
              <span className="font-semibold text-slate-700">{completedTasks}/{totalTasks} tasks</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="progress-fill h-full rounded-full bg-brand-500 transition-all duration-700"
                style={{ width: Math.max(completion ? 4 : 0, completion) + "%" }}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Plan version" value={"v" + plan.version} detail="Versioned and auditable" />
        <Metric label="Weeks" value={String(plan.weeks.length)} detail="Prerequisite-aware sequencing" />
        <Metric label="Planned time" value={formatMinutes(plan.planned_minutes)} detail="Across the active roadmap" />
        <Metric label="Adaptation buffer" value={formatMinutes(plan.adaptation_buffer_minutes) + "/wk"} detail="Reserved for replanning" />
      </section>

      {plan.warnings?.length ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-800">
          {plan.warnings.join(" · ")}
        </div>
      ) : null}

      <div className="space-y-5">
        {plan.weeks.map(week => {
          const percent = Math.min(100, Math.round(100 * week.planned_minutes / Math.max(week.capacity_minutes, 1)));
          const weekTasks = week.objectives.flatMap(objective => objective.tasks);
          const weekDone = weekTasks.filter(task => task.status === "COMPLETED" || optimisticCompleted.has(task.id)).length;

          return (
            <section key={week.id} className="surface-card overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="eyebrow">Week {week.week_index}</p>
                      {weekDone === weekTasks.length && weekTasks.length ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                          <CheckCircle2 className="size-3" /> Complete
                        </span>
                      ) : null}
                    </div>
                    <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-slate-950">
                      {formatDate(week.start_date)} — {formatDate(week.end_date)}
                    </h2>
                    {week.rationale ? <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">{week.rationale}</p> : null}
                  </div>

                  <div className="min-w-48">
                    <div className="flex items-center justify-between gap-4 text-xs">
                      <span className="text-slate-500">{formatMinutes(week.planned_minutes)} planned</span>
                      <span className="font-semibold text-slate-700">{percent}% capacity</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="progress-fill h-full rounded-full bg-brand-400 transition-all duration-700" style={{ width: percent + "%" }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-7 p-5 sm:p-6">
                {week.objectives.map(objective => (
                  <div key={objective.id}>
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-900">{objective.skills?.canonical_name ?? "Skill objective"}</h3>
                          <span className="rounded-md bg-brand-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand-700">
                            {objective.type}
                          </span>
                        </div>
                        <p className="mt-1.5 max-w-3xl text-sm text-slate-500">{objective.success_criteria}</p>
                      </div>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-2">
                      {objective.tasks.map(task => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          completed={task.status === "COMPLETED" || optimisticCompleted.has(task.id)}
                          onOptimistic={markOptimistic}
                          onRollback={rollbackOptimistic}
                          onChanged={() => setRevision(value => value + 1)}
                          onOpen={href => router.push(href)}
                          onNotify={notify}
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
      <ToastNotice toast={toast} onDismiss={dismissToast} />
    </div>
  );
}

function TaskCard({
  task,
  completed,
  onOptimistic,
  onRollback,
  onChanged,
  onOpen,
  onNotify
}: {
  task: Task;
  completed: boolean;
  onOptimistic: (taskId: string) => void;
  onRollback: (taskId: string) => void;
  onChanged: () => void;
  onOpen: (href: string) => void;
  onNotify: (tone: ToastMessage["tone"], title: string, detail?: string) => void;
}) {
  const resource = task.resource?.learning_resources;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function act() {
    if (pending || completed) return;
    setPending(true);
    setError("");

    const validation = task.type === "VALIDATE";
    if (!validation) onOptimistic(task.id);

    try {
      const response = await fetch(
        "/api/tasks/" + task.id + (validation ? "/validate" : "/complete"),
        { method: "POST" }
      );
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        if (!validation) onRollback(task.id);
        const detail = payload.error?.message ?? "Could not update this task.";
        setError(detail);
        onNotify("error", "Task was not updated", detail);
        return;
      }

      if (validation) {
        const href = payload.ui_effects?.next_action?.href;
        if (href) onOpen(href);
        return;
      }

      onNotify("success", "Task completed", "Your plan progress has been updated.");
      onChanged();
    } catch {
      if (!validation) onRollback(task.id);
      const detail = "Could not update this task.";
      setError(detail);
      onNotify("error", "Task was not updated", detail);
    } finally {
      setPending(false);
    }
  }

  const typeTone =
    task.type === "VALIDATE"
      ? "bg-brand-50 text-brand-700"
      : task.type === "BUILD"
        ? "bg-amber-50 text-amber-700"
        : task.type === "PRACTICE"
          ? "bg-blue-50 text-blue-700"
          : "bg-slate-100 text-slate-600";

  return (
    <div
      className={
        "rounded-xl border p-4 transition duration-200 " +
        (completed
          ? "soft-pop border-emerald-100 bg-emerald-50/35"
          : "border-slate-200/80 bg-slate-50/55 hover:-translate-y-px hover:border-slate-300 hover:bg-white hover:shadow-soft")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className={"inline-flex rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide " + typeTone}>
            {task.type}
          </span>
          <p className="mt-2 font-semibold leading-6 text-slate-900">{task.title}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs text-slate-500 ring-1 ring-slate-200">
          <Clock3 className="size-3" />
          {task.duration_minutes}m
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
        <span>{humanize(task.difficulty)}</span>
        {task.due_at ? <span>{new Date(task.due_at).toLocaleDateString()}</span> : null}
        {task.flexible ? <span>Flexible</span> : null}
      </div>

      {resource?.url ? (
        <a
          href={resource.url}
          target="_blank"
          rel="noreferrer"
          className="group mt-3 flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm transition hover:border-brand-200 hover:shadow-sm"
        >
          <span className="min-w-0">
            <span className="block truncate font-medium text-slate-800">{resource.title}</span>
            <span className="mt-0.5 block truncate text-xs text-slate-400">{resource.provider}</span>
          </span>
          <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-slate-400 transition group-hover:text-brand-600" />
        </a>
      ) : null}

      <div className="mt-4">
        {completed ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
            {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
            {pending ? "Saving completion…" : "Completed"}
          </span>
        ) : task.type === "VALIDATE" && task.validation_available === false ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-500">
              Validation bank not ready
            </span>
            <button type="button" onClick={() => onOpen("/practice")} className="btn-secondary !px-3 !py-2 !text-xs">
              Try another challenge
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={act}
            disabled={pending}
            className={task.type === "VALIDATE" ? "btn-primary !px-3 !py-2 !text-xs" : "btn-secondary !px-3 !py-2 !text-xs"}
          >
            {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
            {pending
              ? task.type === "VALIDATE" ? "Preparing" : "Saving"
              : task.type === "VALIDATE" ? "Start validation" : "Mark complete"}
          </button>
        )}
        {error ? <p className="mt-2 text-xs text-rose-700">{error}</p> : null}
      </div>
    </div>
  );
}

function RoadmapSkeleton() {
  return (
    <div className="space-y-5">
      <div className="surface-card p-6">
        <div className="skeleton h-3 w-28 rounded-full" />
        <div className="skeleton mt-4 h-8 w-64 rounded-xl" />
        <div className="skeleton mt-3 h-4 w-[30rem] max-w-full rounded-lg" />
      </div>
      {[0, 1].map(item => (
        <div key={item} className="surface-card p-6">
          <div className="flex justify-between gap-4">
            <div className="w-full max-w-sm">
              <div className="skeleton h-3 w-20 rounded-full" />
              <div className="skeleton mt-3 h-6 w-52 rounded-lg" />
            </div>
            <div className="skeleton h-8 w-36 rounded-lg" />
          </div>
          <div className="mt-6 grid gap-3 lg:grid-cols-2">
            {[0, 1, 2, 3].map(card => (
              <div key={card} className="rounded-xl border border-slate-200 p-4">
                <div className="skeleton h-4 w-16 rounded-md" />
                <div className="skeleton mt-3 h-5 w-3/4 rounded-lg" />
                <div className="skeleton mt-4 h-9 w-28 rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="surface-card p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-400">{detail}</p>
    </div>
  );
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return minutes + "m";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? hours + "h " + rest + "m" : hours + "h";
}

function formatDate(value: string) {
  return new Date(value + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function humanize(value: string) {
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase());
}
