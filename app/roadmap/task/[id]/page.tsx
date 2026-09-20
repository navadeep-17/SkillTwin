import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Gauge,
  ShieldCheck,
  Sparkles,
  Target
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TaskDetailActions } from "@/components/roadmap/task-detail-actions";

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function RoadmapTaskPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: task, error } = await supabase
    .from("learning_tasks")
    .select(
      "id,plan_id,week_id,objective_id,skill_id,type,title,duration_minutes,due_at,status,difficulty,flexible,rationale_code,completed_at,started_at,reschedule_count,learning_plans!inner(user_id,version,status,start_date,end_date),plan_weeks!inner(week_index,start_date,end_date,capacity_minutes,planned_minutes),learning_objectives!inner(type,start_score,target_score,success_criteria,priority_at_creation,status),skills!inner(slug,canonical_name,category,description)"
    )
    .eq("id", id)
    .eq("learning_plans.user_id", auth.user.id)
    .maybeSingle();

  if (error) throw error;
  if (!task) notFound();

  const { data: assignment, error: assignmentError } = await supabase
    .from("task_resource_assignments")
    .select("rank_score,ranker_version,explanation,learning_resources!inner(id,title,provider,url,format,duration_minutes,quality)")
    .eq("task_id", id)
    .order("rank_score", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (assignmentError) throw assignmentError;

  const plan = one(task.learning_plans as
    | { user_id?: string; version?: number; status?: string; start_date?: string; end_date?: string }
    | Array<{ user_id?: string; version?: number; status?: string; start_date?: string; end_date?: string }>
    | null);
  const week = one(task.plan_weeks as
    | { week_index?: number; start_date?: string; end_date?: string; capacity_minutes?: number; planned_minutes?: number }
    | Array<{ week_index?: number; start_date?: string; end_date?: string; capacity_minutes?: number; planned_minutes?: number }>
    | null);
  const objective = one(task.learning_objectives as
    | { type?: string; start_score?: number | null; target_score?: number; success_criteria?: string; priority_at_creation?: number; status?: string }
    | Array<{ type?: string; start_score?: number | null; target_score?: number; success_criteria?: string; priority_at_creation?: number; status?: string }>
    | null);
  const skill = one(task.skills as
    | { slug?: string; canonical_name?: string; category?: string | null; description?: string | null }
    | Array<{ slug?: string; canonical_name?: string; category?: string | null; description?: string | null }>
    | null);
  const resource = one(assignment?.learning_resources as
    | { id?: string; title?: string; provider?: string; url?: string; format?: string; duration_minutes?: number; quality?: number }
    | Array<{ id?: string; title?: string; provider?: string; url?: string; format?: string; duration_minutes?: number; quality?: number }>
    | null);

  const completed = task.status === "COMPLETED";
  const stale = plan?.status !== "ACTIVE";
  const canValidate = task.type === "VALIDATE" && !completed && !stale;
  const canComplete = task.type !== "VALIDATE" && !completed && !stale;

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
      <Link href="/roadmap" className="quiet-link inline-flex items-center gap-1.5">
        <ArrowLeft className="size-4" />
        Back to roadmap
      </Link>

      <section className="surface-card hero-wash relative mt-5 overflow-hidden p-6 sm:p-8">
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className={taskTone(String(task.type))}>{humanize(String(task.type))}</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600">
                {humanize(String(task.difficulty))}
              </span>
              {completed ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-700">
                  <CheckCircle2 className="size-3" />
                  Completed
                </span>
              ) : null}
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.025em] text-slate-950">{task.title}</h1>
            <p className="mt-3 text-[15px] leading-7 text-slate-600">
              {objective?.success_criteria ?? "Complete this task to move the active role objective forward."}
            </p>
          </div>

          <TaskDetailActions
            taskId={String(task.id)}
            taskType={String(task.type)}
            completed={completed}
            stale={stale}
          />
        </div>
      </section>

      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Clock3} label="Duration" value={formatMinutes(Number(task.duration_minutes ?? 0))} />
        <Metric icon={CalendarDays} label="Week" value={"Week " + String(week?.week_index ?? "—")} />
        <Metric icon={Gauge} label="Plan" value={"v" + String(plan?.version ?? "—")} />
        <Metric icon={Target} label="Target score" value={objective?.target_score == null ? "—" : Number(objective.target_score).toFixed(1) + " / 4"} />
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
        <div className="surface-card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
            <p className="eyebrow">Why this task exists</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">Role objective context</h2>
          </div>
          <div className="space-y-5 p-5 sm:p-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Sparkles className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{humanize(String(task.rationale_code ?? "adaptive roadmap"))}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    This task belongs to the active {skill?.canonical_name ?? "skill"} objective and is kept traceable to the roadmap rule that created it.
                  </p>
                </div>
              </div>
            </div>

            <InfoRow label="Skill" value={skill?.canonical_name ?? "—"} />
            <InfoRow label="Category" value={skill?.category ?? "—"} />
            <InfoRow label="Objective type" value={humanize(String(objective?.type ?? "—"))} />
            <InfoRow label="Current objective score" value={objective?.start_score == null ? "Unknown" : Number(objective.start_score).toFixed(1) + " / 4"} />
            <InfoRow label="Due" value={task.due_at ? new Date(task.due_at).toLocaleString() : "No fixed due time"} />
            <InfoRow label="Scheduling" value={task.flexible ? "Flexible" : "Fixed within the current plan"} />
            <InfoRow label="Week capacity" value={formatMinutes(Number(week?.planned_minutes ?? 0)) + " / " + formatMinutes(Number(week?.capacity_minutes ?? 0))} />

            {skill?.description ? (
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Skill context</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{skill.description}</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-5">
          <section className="surface-card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <p className="eyebrow">Verified resource</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">Recommended material</h2>
            </div>
            <div className="p-5">
              {resource?.url ? (
                <>
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                      <BookOpen className="size-4.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{resource.title}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {resource.provider ?? "Verified provider"} · {humanize(String(resource.format ?? "resource"))}
                      </p>
                    </div>
                  </div>

                  {assignment?.explanation ? (
                    <p className="mt-4 text-sm leading-6 text-slate-600">{String(assignment.explanation)}</p>
                  ) : null}

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <SmallMetric label="Quality" value={resource.quality == null ? "Verified" : Math.round(Number(resource.quality) * 100) + "%"} />
                    <SmallMetric label="Length" value={resource.duration_minutes == null ? "—" : formatMinutes(Number(resource.duration_minutes))} />
                  </div>

                  <a href={resource.url} target="_blank" rel="noreferrer" className="btn-secondary mt-5 w-full justify-center">
                    Open verified resource <ExternalLink className="size-4" />
                  </a>
                </>
              ) : (
                <div className="py-5 text-center">
                  <BookOpen className="mx-auto size-5 text-slate-400" />
                  <p className="mt-3 text-sm font-semibold text-slate-700">No resource assignment</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">This task can still be completed using your preferred material.</p>
                </div>
              )}
            </div>
          </section>

          <section className="surface-card p-5">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <ShieldCheck className="size-4" />
              </span>
              <div>
                <h2 className="font-semibold text-slate-900">Evidence behavior</h2>
                <p className="mt-1.5 text-sm leading-6 text-slate-600">
                  {task.type === "VALIDATE"
                    ? "Validation runs through Challenge Me. Its scored assessment summary can update capability and confidence."
                    : "Marking learning work complete records activity evidence, but passive completion alone does not prove proficiency."}
                </p>
              </div>
            </div>
          </section>

          {stale ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
              This task belongs to an older plan version. Open the active roadmap before taking action.
            </div>
          ) : null}
        </div>
      </section>

      <div className="mt-7 flex flex-wrap gap-3">
        <Link href="/roadmap" className="btn-secondary">Back to roadmap</Link>
        <Link href={"/skills#skill-" + task.skill_id} className="btn-secondary">
          View SkillTwin evidence <ArrowRight className="size-4" />
        </Link>
      </div>
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
}) {
  return (
    <div className="surface-card flex items-center gap-3 p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <Icon className="size-4" />
      </span>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-0.5 font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-5 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="max-w-[60%] text-right text-sm font-semibold text-slate-800">{value}</span>
    </div>
  );
}

function taskTone(type: string) {
  if (type === "VALIDATE") return "rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-brand-700";
  if (type === "BUILD") return "rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-700";
  if (type === "PRACTICE") return "rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-blue-700";
  return "rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600";
}

function humanize(value: string) {
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase());
}

function formatMinutes(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "—";
  if (minutes < 60) return minutes + "m";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? hours + "h " + rest + "m" : hours + "h";
}
