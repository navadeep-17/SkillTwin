import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { UndoPlanChangeButton } from "@/components/roadmap/undo-plan-change-button";

function parseJson(value: unknown): unknown {
  let current = value;
  for (let depth = 0; depth < 2 && typeof current === "string"; depth += 1) {
    try {
      current = JSON.parse(current);
    } catch {
      break;
    }
  }
  return current;
}

type Operation = {
  type?: string;
  task?: {
    title?: string;
    durationMinutes?: number;
    taskType?: string;
    dueAt?: string;
    rationaleCode?: string;
  };
  reasonRefs?: string[];
};

export default async function RoadmapChangePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { id } = await params;
  const { data: diff, error } = await supabase
    .from("plan_diffs")
    .select("id,status,from_version,to_version,summary,reason,operations,weekly_impact,timeline_impact,total_minute_delta,touch_count,complexity,can_undo,created_at,applied_at")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error) throw error;
  if (!diff) notFound();

  const parsedOperations = parseJson(diff.operations);
  const parsedWeeklyImpact = parseJson(diff.weekly_impact);
  const operations = Array.isArray(parsedOperations) ? parsedOperations as Operation[] : [];
  const weeklyImpact = Array.isArray(parsedWeeklyImpact) ? parsedWeeklyImpact as Array<Record<string, unknown>> : [];

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
      <Link href="/roadmap" className="quiet-link inline-flex items-center gap-1.5">
        <ArrowLeft className="size-4" />
        Back to plan
      </Link>

      <section className="surface-card hero-wash relative mt-5 overflow-hidden p-6 sm:p-8">
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700">
              <Sparkles className="size-3.5" />
              See what changed
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.025em] text-slate-950">{diff.summary}</h1>
            <p className="mt-3 text-[15px] leading-7 text-slate-600">{diff.reason}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="size-3.5" />
            {humanize(String(diff.status))}
          </span>
        </div>
      </section>

      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Plan version" value={"v" + diff.from_version + " → v" + (diff.to_version ?? "—")} />
        <Metric label="Tasks touched" value={String(diff.touch_count)} />
        <Metric label="Workload change" value={(Number(diff.total_minute_delta) >= 0 ? "+" : "") + diff.total_minute_delta + " min"} />
        <Metric label="Complexity" value={humanize(String(diff.complexity))} />
      </section>

      <section className="surface-card mt-6 overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <p className="eyebrow">PlanDiff operations</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">Only affected future work changed</h2>
        </div>

        <div className="p-5 sm:p-6">
          <div className="space-y-3">
            {operations.map((operation, index) => (
              <div
                key={index}
                className="fade-up relative rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                style={{ animationDelay: index * 60 + "ms" }}
              >
                <div className="flex items-start gap-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-xs font-bold text-brand-600 shadow-sm ring-1 ring-slate-200">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-600">
                          {humanize(operation.type ?? "CHANGE")}
                        </p>
                        <p className="mt-1 font-semibold text-slate-900">{operation.task?.title ?? "Roadmap task changed"}</p>
                      </div>
                      {operation.task?.durationMinutes ? (
                        <span className="rounded-lg bg-white px-2.5 py-1 text-xs text-slate-500 ring-1 ring-slate-200">
                          {operation.task.durationMinutes} min
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      {operation.task?.taskType ? <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">{humanize(operation.task.taskType)}</span> : null}
                      {operation.task?.dueAt ? <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">Due {new Date(operation.task.dueAt).toLocaleDateString()}</span> : null}
                      {operation.task?.rationaleCode ? <span className="rounded-full bg-brand-50 px-2.5 py-1 text-brand-700">{humanize(operation.task.rationaleCode)}</span> : null}
                    </div>
                    {operation.reasonRefs?.length ? (
                      <p className="mt-3 text-xs leading-5 text-slate-400">
                        Trigger references: {operation.reasonRefs.join(" · ")}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {weeklyImpact.length ? (
        <section className="surface-card mt-5 p-5 sm:p-6">
          <h2 className="font-semibold text-slate-900">Weekly impact</h2>
          <div className="mt-4 space-y-3">
            {weeklyImpact.map((impact, index) => {
              const before = Number(impact.beforeMinutes ?? 0);
              const after = Number(impact.afterMinutes ?? 0);
              const delta = after - before;
              return (
                <div key={index} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm">
                  <span className="font-medium text-slate-700">Week {String(impact.weekIndex ?? "—")}</span>
                  <span className="text-slate-500">
                    {before} → {after} min
                    <span className={"ml-2 font-semibold " + (delta > 0 ? "text-amber-700" : delta < 0 ? "text-emerald-700" : "text-slate-500")}>
                      {delta > 0 ? "+" : ""}{delta}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="mt-7 flex flex-wrap gap-3">
        <Link href="/roadmap" className="btn-primary">
          View updated plan <ArrowRight className="size-4" />
        </Link>
        {diff.status === "APPLIED" && diff.can_undo ? <UndoPlanChangeButton diffId={diff.id} /> : null}
        <Link href="/overview" className="btn-secondary">Back to home</Link>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1.5 text-xl font-semibold tracking-tight text-slate-950">{value}</p>
    </div>
  );
}

function humanize(value: string) {
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase());
}
