import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock3,
  ShieldCheck,
  Sparkles,
  TrendingUp
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { WeeklyReportCard } from "@/components/progress/weekly-report-card";
import { ReadinessTrendChart } from "@/components/progress/readiness-trend-chart";

export default async function ProgressPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const [
    { data: snapshots, error: snapshotError },
    { data: history, error: historyError },
    { data: plans, error: plansError },
    { data: assessments, error: assessmentError },
    { data: diffs, error: diffError }
  ] = await Promise.all([
    supabase
      .from("gap_snapshots")
      .select("id,readiness,evidence_coverage,created_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: true })
      .limit(12),
    supabase
      .from("skill_history")
      .select("id,skill_id,trigger_type,explanation,before_state,after_state,created_at,skills!inner(canonical_name)")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("learning_plans")
      .select("id,version,status,planned_minutes,created_at")
      .eq("user_id", auth.user.id)
      .order("version", { ascending: false }),
    supabase
      .from("skill_assessment_outcomes")
      .select("id,normalized_score,coverage,created_at,skills!inner(canonical_name)")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("plan_diffs")
      .select("id,status,from_version,to_version,summary,total_minute_delta,created_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(10)
  ]);

  for (const error of [snapshotError, historyError, plansError, assessmentError, diffError]) {
    if (error) throw error;
  }

  const { data: tasks, error: tasksError } = await supabase
    .from("learning_tasks")
    .select("id,status,duration_minutes,type,learning_plans!inner(user_id)")
    .eq("learning_plans.user_id", auth.user.id);
  if (tasksError) throw tasksError;

  const completed = (tasks ?? []).filter(task => task.status === "COMPLETED");
  const totalMinutes = completed.reduce((sum, task) => sum + Number(task.duration_minutes), 0);
  const latestSnapshot = snapshots?.at(-1) ?? null;
  const firstSnapshot = snapshots?.[0] ?? null;
  const readinessDelta = latestSnapshot && firstSnapshot
    ? Number(latestSnapshot.readiness) - Number(firstSnapshot.readiness)
    : 0;

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="mb-7 max-w-3xl">
        <p className="eyebrow">Progress</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.025em] text-slate-950">
          See what changed because you learned.
        </h1>
        <p className="mt-3 text-[15px] leading-7 text-slate-600">
          SkillTwin keeps learning activity separate from validated capability. Time spent is useful context, but only accepted evidence changes your learner state.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={TrendingUp}
          label="Current readiness"
          value={latestSnapshot ? Math.round(Number(latestSnapshot.readiness)) + "%" : "—"}
          detail="Against your active target role"
        />
        <Metric
          icon={Sparkles}
          label="Readiness change"
          value={(readinessDelta >= 0 ? "+" : "") + Math.round(readinessDelta) + " pts"}
          detail="Across stored gap snapshots"
          positive={readinessDelta > 0}
        />
        <Metric
          icon={CheckCircle2}
          label="Completed tasks"
          value={String(completed.length)}
          detail="Learning work marked complete"
        />
        <Metric
          icon={Clock3}
          label="Learning time"
          value={formatMinutes(totalMinutes)}
          detail="Completed roadmap time"
        />
      </section>

      <section className="surface-card hero-wash relative mt-6 overflow-hidden p-5 sm:p-6">
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Readiness trend</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Role readiness vs. evidence coverage</h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
              Readiness can move only when the underlying evidence-backed skill state changes. Coverage shows how much of the role has usable evidence.
            </p>
          </div>
          {latestSnapshot ? (
            <div className="flex gap-4 text-xs">
              <Legend dot="bg-brand-500" label="Readiness" />
              <Legend dot="bg-slate-400" label="Evidence coverage" />
            </div>
          ) : null}
        </div>

        {snapshots?.length ? (
          <ReadinessTrendChart snapshots={snapshots.map(snapshot => ({
            id: snapshot.id,
            readiness: Number(snapshot.readiness),
            coverage: Number(snapshot.evidence_coverage),
            createdAt: snapshot.created_at
          }))} />
        ) : (
          <EmptyState
            icon={TrendingUp}
            title="No readiness history yet"
            detail="Add evidence and create a target-role gap snapshot to start tracking validated progress."
          />
        )}
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <div className="surface-card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
            <p className="eyebrow">SkillDelta history</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">Recent capability changes</h2>
          </div>
          <div className="px-5 py-2 sm:px-6">
            {history?.length ? history.map((item, index) => {
              const skill = item.skills as { canonical_name?: string } | null;
              return (
                <article key={item.id} className="relative flex gap-4 border-b border-slate-100 py-5 last:border-b-0">
                  {index < history.length - 1 ? (
                    <span className="absolute left-[7px] top-9 h-[calc(100%-16px)] w-px bg-slate-200" />
                  ) : null}
                  <span className="relative mt-1.5 size-3.5 shrink-0 rounded-full border-[3px] border-white bg-brand-400 shadow-[0_0_0_1px_#E4E7EC]" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-600">
                      {skill?.canonical_name ?? "Skill"}
                    </p>
                    <p className="mt-1.5 text-sm leading-6 text-slate-700">{item.explanation}</p>
                    <p className="mt-2 text-xs text-slate-400">{new Date(item.created_at).toLocaleString()}</p>
                  </div>
                </article>
              );
            }) : (
              <EmptyState
                icon={Activity}
                title="No SkillDelta history yet"
                detail="Validated assessments and accepted evidence changes will appear here."
              />
            )}
          </div>
        </div>

        <div className="surface-card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
            <p className="eyebrow">Validation</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">Assessment history</h2>
          </div>
          <div className="p-5 sm:p-6">
            {assessments?.length ? (
              <div className="space-y-3">
                {assessments.map(item => {
                  const skill = item.skills as { canonical_name?: string } | null;
                  const score = Math.round(Number(item.normalized_score) * 100);
                  const coverage = Math.round(Number(item.coverage) * 100);
                  return (
                    <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{skill?.canonical_name ?? "Assessment"}</p>
                          <p className="mt-1 text-xs text-slate-400">{new Date(item.created_at).toLocaleDateString()}</p>
                        </div>
                        <span className="text-lg font-semibold tracking-tight text-slate-950">{score}%</span>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                        <span>Concept coverage</span>
                        <span className="font-semibold text-slate-600">{coverage}%</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
                        <div className="progress-fill h-full rounded-full bg-brand-400" style={{ width: Math.max(2, coverage) + "%" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={ShieldCheck}
                title="No completed validations"
                detail="Challenge Me results will appear here once an assessment is completed."
              />
            )}
          </div>
        </div>
      </section>

      <WeeklyReportCard />

      <section className="surface-card mt-6 overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <p className="eyebrow">Roadmap evolution</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">How your plan adapted</h2>
          </div>
          {plans?.length ? (
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500">
              {plans.length} immutable version{plans.length === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
          {diffs?.length ? diffs.map(item => (
            <Link
              key={item.id}
              href={"/roadmap/changes/" + item.id}
              className="group rounded-xl border border-slate-200 bg-white p-4 transition duration-200 hover:-translate-y-px hover:border-brand-200 hover:shadow-soft"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-md bg-brand-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-700">
                  {humanize(String(item.status))}
                </span>
                <ArrowRight className="size-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-500" />
              </div>
              <p className="mt-3 font-semibold leading-6 text-slate-900">{item.summary}</p>
              <p className="mt-2 text-xs text-slate-500">
                Plan v{item.from_version} → v{item.to_version ?? "—"} · {Number(item.total_minute_delta) >= 0 ? "+" : ""}{item.total_minute_delta} min
              </p>
            </Link>
          )) : (
            <div className="sm:col-span-2">
              <EmptyState
                icon={Sparkles}
                title="No adaptive roadmap changes yet"
                detail="When new evidence changes your future work, the exact PlanDiff will appear here."
              />
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
  positive = false
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  detail: string;
  positive?: boolean;
}) {
  return (
    <div className="surface-card p-5 transition duration-200 hover:-translate-y-px hover:shadow-lift">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className={"mt-2 text-2xl font-semibold tracking-tight " + (positive ? "text-emerald-700" : "text-slate-950")}>{value}</p>
        </div>
        <span className="flex size-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Icon className="size-4.5" />
        </span>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-400">{detail}</p>
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600">
      <span className={"size-2 rounded-full " + dot} />
      {label}
    </span>
  );
}

function EmptyState({
  icon: Icon,
  title,
  detail
}: {
  icon: typeof Activity;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex min-h-36 flex-col items-center justify-center px-4 py-8 text-center">
      <span className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
        <Icon className="size-4.5" />
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return minutes + "m";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? hours + "h " + rest + "m" : hours + "h";
}

function humanize(value: string) {
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase());
}
