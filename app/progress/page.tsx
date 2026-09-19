import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">Progress</p>
        <h1 className="mt-2 text-3xl font-semibold">How your SkillTwin is changing</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Progress separates learning activity from validated capability changes so time spent never masquerades as proven skill.
        </p>
      </header>

      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <Metric label="Current readiness" value={latestSnapshot ? latestSnapshot.readiness + "%" : "—"} />
        <Metric label="Readiness change" value={(readinessDelta >= 0 ? "+" : "") + readinessDelta + " pts"} />
        <Metric label="Completed tasks" value={String(completed.length)} />
        <Metric label="Learning time logged" value={formatMinutes(totalMinutes)} />
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Readiness trend</h2>
        {snapshots?.length ? (
          <div className="mt-6 flex h-48 items-end gap-3 overflow-x-auto border-b border-slate-200 pb-2">
            {snapshots.map(snapshot => (
              <div key={snapshot.id} className="flex min-w-14 flex-1 flex-col items-center justify-end">
                <span className="mb-2 text-xs font-medium">{snapshot.readiness}%</span>
                <div
                  className="w-full max-w-12 rounded-t-lg bg-brand-600"
                  style={{ height: Math.max(8, Number(snapshot.readiness) * 1.5) + "px" }}
                  title={"Evidence coverage " + snapshot.evidence_coverage + "%"}
                />
                <span className="mt-2 text-[10px] text-slate-400">
                  {new Date(snapshot.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">No readiness snapshots yet.</p>
        )}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Recent skill changes</h2>
          <div className="mt-4 space-y-3">
            {history?.length ? history.map(item => {
              const skill = item.skills as { canonical_name?: string } | null;
              return (
                <div key={item.id} className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{skill?.canonical_name ?? "Skill"}</p>
                  <p className="mt-2 text-sm text-slate-700">{item.explanation}</p>
                  <p className="mt-2 text-xs text-slate-400">{new Date(item.created_at).toLocaleString()}</p>
                </div>
              );
            }) : <p className="text-sm text-slate-500">No SkillDelta history yet.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Validation history</h2>
          <div className="mt-4 space-y-3">
            {assessments?.length ? assessments.map(item => {
              const skill = item.skills as { canonical_name?: string } | null;
              return (
                <div key={item.id} className="rounded-xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{skill?.canonical_name ?? "Assessment"}</p>
                    <span className="text-sm font-semibold">{Math.round(Number(item.normalized_score) * 100)}%</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Coverage {Math.round(Number(item.coverage) * 100)}%</p>
                </div>
              );
            }) : <p className="text-sm text-slate-500">No completed validations yet.</p>}
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Roadmap evolution</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {diffs?.length ? diffs.map(item => (
            <a
              key={item.id}
              href={"/roadmap/changes/" + item.id}
              className="rounded-xl border border-slate-200 p-4 hover:border-brand-300"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{item.status}</p>
              <p className="mt-1 font-medium">{item.summary}</p>
              <p className="mt-2 text-sm text-slate-500">
                Plan v{item.from_version} → v{item.to_version ?? "—"} · {Number(item.total_minute_delta) >= 0 ? "+" : ""}{item.total_minute_delta} min
              </p>
            </a>
          )) : <p className="text-sm text-slate-500">No adaptive roadmap changes yet.</p>}
        </div>
        {plans?.length ? (
          <p className="mt-5 text-xs text-slate-400">{plans.length} immutable plan version{plans.length === 1 ? "" : "s"} stored.</p>
        ) : null}
      </section>
    </main>
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
