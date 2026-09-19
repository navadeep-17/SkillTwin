import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/config/env";
import { DemoResetControl } from "@/components/demo/demo-reset-control";

export default async function DemoPage() {
  const env = getServerEnv();
  if (env.DEMO_FALLBACK_ENABLED !== "true") notFound();

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const [
    documents,
    snapshot,
    plan,
    assessment,
    diff
  ] = await Promise.all([
    supabase
      .from("profile_documents")
      .select("id,analysis_status,created_at")
      .eq("user_id", auth.user.id)
      .eq("document_type", "resume")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("gap_snapshots")
      .select("id,readiness,evidence_coverage,created_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("learning_plans")
      .select("id,version,status,planned_minutes,created_at")
      .eq("user_id", auth.user.id)
      .eq("status", "ACTIVE")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("skill_assessment_outcomes")
      .select("id,normalized_score,coverage,created_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("plan_diffs")
      .select("id,status,from_version,to_version,summary,created_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  for (const result of [documents, snapshot, plan, assessment, diff]) {
    if (result.error) throw result.error;
  }

  const resume = documents.data;
  const gap = snapshot.data;
  const activePlan = plan.data;
  const latestAssessment = assessment.data;
  const latestDiff = diff.data;

  const steps = [
    {
      label: "1. Resume analysis",
      ready: resume?.analysis_status === "complete",
      detail: resume ? "Latest resume: " + resume.analysis_status : "No resume yet",
      href: "/onboarding"
    },
    {
      label: "2. SkillTwin + role gaps",
      ready: Boolean(gap),
      detail: gap
        ? "Readiness " + gap.readiness + "% · evidence coverage " + gap.evidence_coverage + "%"
        : "No gap snapshot yet",
      href: "/overview"
    },
    {
      label: "3. Plan v1+",
      ready: Boolean(activePlan),
      detail: activePlan
        ? "Active Plan v" + activePlan.version + " · " + activePlan.planned_minutes + " planned min"
        : "No active plan yet",
      href: "/roadmap"
    },
    {
      label: "4. Challenge Me completed",
      ready: Boolean(latestAssessment),
      detail: latestAssessment
        ? "Latest score " + Math.round(Number(latestAssessment.normalized_score) * 100) + "%"
        : "No completed assessment yet",
      href: "/practice"
    },
    {
      label: "5. PlanDiff created",
      ready: Boolean(latestDiff),
      detail: latestDiff
        ? "v" + latestDiff.from_version + " → v" + (latestDiff.to_version ?? "—") + " · " + latestDiff.status
        : "No roadmap change yet",
      href: latestDiff ? "/roadmap/changes/" + latestDiff.id : "/roadmap"
    },
    {
      label: "6. Grounded explanation",
      ready: Boolean(latestDiff),
      detail: latestDiff
        ? "Ask: “Why did my roadmap change?”"
        : "Create a roadmap change first",
      href: "/journey"
    },
    {
      label: "7. Audit trail",
      ready: Boolean(gap || latestAssessment || latestDiff),
      detail: "Verify committed actions are visible without hidden reasoning",
      href: "/activity"
    }
  ];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">Demo console</p>
        <h1 className="mt-2 text-3xl font-semibold">SkillTwin judge-flow rehearsal</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Hidden hackathon utility. It reads only the current signed-in learner state and does not alter the normal product flow.
        </p>
      </header>

      <section className="mt-8 grid gap-4">
        {steps.map(step => (
          <Link
            key={step.label}
            href={step.href}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-300"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{step.label}</h2>
                <p className="mt-1 text-sm text-slate-600">{step.detail}</p>
              </div>
              <span
                className={
                  step.ready
                    ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                    : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500"
                }
              >
                {step.ready ? "READY" : "PENDING"}
              </span>
            </div>
          </Link>
        ))}
      </section>

      <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Repeat demo safely</p>
        <h2 className="mt-1 text-xl font-semibold text-amber-950">Reset this learner only</h2>
        <p className="mt-2 max-w-2xl text-sm text-amber-900">
          This preserves the Auth account, role/skill taxonomy, verified learning resources, and assessment question bank.
        </p>
        <div className="mt-5">
          <DemoResetControl />
        </div>
      </section>
    </main>
  );
}
