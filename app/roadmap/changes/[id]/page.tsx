import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UndoPlanChangeButton } from "@/components/roadmap/undo-plan-change-button";
import { PlanDiffDecisionButtons } from "@/components/roadmap/plan-diff-decision-buttons";

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

  const operations = Array.isArray(diff.operations) ? diff.operations as Operation[] : [];
  const weeklyImpact = Array.isArray(diff.weekly_impact) ? diff.weekly_impact as Array<Record<string, unknown>> : [];

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">See What Changed</p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">{diff.summary}</h1>
          <p className="mt-2 max-w-2xl text-slate-600">{diff.reason}</p>
        </div>
        <span className={diff.status==="PROPOSED"?"rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700":"rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700"}>{diff.status}</span>
      </div>

      <section className="mt-7 grid gap-4 sm:grid-cols-4">
        <Metric label="Plan version" value={"v" + diff.from_version + " → v" + (diff.to_version ?? "—")} />
        <Metric label="Tasks touched" value={String(diff.touch_count)} />
        <Metric label="Workload change" value={(Number(diff.total_minute_delta) >= 0 ? "+" : "") + diff.total_minute_delta + " min"} />
        <Metric label="Complexity" value={String(diff.complexity)} />
      </section>

      <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Exact backend operations</p>
        <div className="mt-4 space-y-3">
          {operations.map((operation, index) => (
            <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{operation.type ?? "CHANGE"}</p>
                  <p className="mt-1 font-semibold">{operation.task?.title ?? operationTitle(operation)}</p>
                </div>
                {operation.task?.durationMinutes ? (
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs">{operation.task.durationMinutes} min</span>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-600">
                {operation.task?.taskType ? <span>{operation.task.taskType}</span> : null}
                {operation.task?.dueAt ? <span>Due {new Date(operation.task.dueAt).toLocaleDateString()}</span> : null}
                {operation.task?.rationaleCode ? <span>{humanize(operation.task.rationaleCode)}</span> : null}
              </div>
              {operation.reasonRefs?.length ? (
                <p className="mt-3 text-xs text-slate-500">Reason refs: {operation.reasonRefs.join(" · ")}</p>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {weeklyImpact.length ? (
        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold">Weekly impact</h2>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            {weeklyImpact.map((impact, index) => (
              <p key={index}>
                Week {String(impact.weekIndex ?? "—")}: {String(impact.beforeMinutes ?? "—")} → {String(impact.afterMinutes ?? "—")} planned minutes
              </p>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-7 flex flex-wrap gap-3">
        {diff.status === "PROPOSED" ? <PlanDiffDecisionButtons diffId={diff.id} /> : <Link href="/roadmap" className="rounded-xl bg-brand-600 px-4 py-2 font-medium text-white">View updated roadmap</Link>}
        {diff.status === "APPLIED" && diff.can_undo ? <UndoPlanChangeButton diffId={diff.id} /> : null}
        <Link href="/overview" className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-medium">Back to overview</Link>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function operationTitle(operation: Operation & Record<string, unknown>) {
  if (operation.type === "MOVE_TASK") return "Move a future roadmap task";
  if (operation.type === "REMOVE_TASK") return "Remove redundant future work";
  if (operation.type === "CHANGE_DIFFICULTY") return "Change future task difficulty";
  if (operation.type === "CHANGE_DURATION") return "Resize a future learning session";
  if (operation.type === "CHANGE_RESOURCE") return "Switch to a verified learning resource";
  return "Roadmap task changed";
}

function humanize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase());
}
