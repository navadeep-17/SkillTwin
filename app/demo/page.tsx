import Link from "next/link";
import type { Route } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/config/env";
import { DemoResetControl } from "@/components/demo/demo-reset-control";
import { buildTwinProofTrail } from "@/lib/domain/twin-challenge";

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
    skillHistory,
    diffs,
    replanDecisions
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
      .select("id,assessment_id,skill_id,normalized_score,coverage,created_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("skill_history")
      .select("skill_id,trigger_ref,before_state,after_state,explanation,created_at")
      .eq("user_id", auth.user.id)
      .eq("trigger_type", "ASSESSMENT_COMPLETED")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("plan_diffs")
      .select("id,status,trigger_refs,from_version,to_version,summary,created_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("replan_decisions")
      .select("trigger_ref,decision,reason_code,reason,created_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(100)
  ]);

  for (const result of [documents, snapshot, plan, assessment, skillHistory, diffs, replanDecisions]) {
    if (result.error) throw result.error;
  }

  const resume = documents.data;
  const gap = snapshot.data;
  const activePlan = plan.data;
  const latestAssessment = assessment.data;
  // Link the demonstrated adaptation only to the exact completed assessment,
  // never to an unrelated past NO_OP or PlanDiff from the same learner.
  const proof = latestAssessment
    ? buildTwinProofTrail(
        {
          assessment_id: String(latestAssessment.assessment_id),
          skill_id: String(latestAssessment.skill_id),
          normalized_score: latestAssessment.normalized_score,
          coverage: latestAssessment.coverage,
          created_at: String(latestAssessment.created_at)
        },
        skillHistory.data ?? [],
        replanDecisions.data ?? [],
        diffs.data ?? []
      )
    : null;
  const appliedDiff = proof?.planDiffId
    ? (diffs.data ?? []).find(item => item.id === proof.planDiffId)
    : null;
  const assessmentReplanned = proof?.planStatus === "CHANGED" || proof?.planStatus === "UNCHANGED";

  const steps: Array<{ label: string; ready: boolean; detail: string; href: Route }> = [
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
      href: latestAssessment
        ? (("/challenge-my-twin?skillId=" + latestAssessment.skill_id) as Route)
        : "/practice"
    },
    {
      label: "5. Assessment-linked replanning decision",
      ready: assessmentReplanned,
      detail: proof
        ? proof.planStatus === "CHANGED" && appliedDiff
          ? "APPLIED PlanDiff v" + appliedDiff.from_version + " → v" + (appliedDiff.to_version ?? "—")
          : proof.planStatus === "UNCHANGED"
            ? "Justified NO_OP for this assessment"
            : "No decision linked to this completed assessment yet"
        : "Complete one real skill assessment first",
      href: appliedDiff
        ? (("/roadmap/changes/" + appliedDiff.id) as Route)
        : "/challenge-my-twin"
    },
    {
      label: "6. Grounded explanation",
      ready: assessmentReplanned,
      detail: proof && assessmentReplanned
        ? proof.planReason
        : "A reason is required for this assessment's plan outcome",
      href: "/challenge-my-twin"
    },
    {
      label: "7. Audit trail",
      ready: Boolean(gap || latestAssessment),
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

      <div className="mt-5 flex flex-wrap gap-3">
        <Link href="/challenge-my-twin" className="btn-primary">Start a proof challenge →</Link>
        <Link href="/practice" className="btn-secondary">Resume a challenge</Link>
      </div>

      {proof ? (
        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-5 text-white sm:p-7" aria-label="Verified assessment transformation">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-sky-300">Real learner proof · assessment linked</p>
              <h2 className="mt-2 text-2xl font-semibold">What SkillTwin actually learned</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                This result comes from stored assessment evidence, not a fixture or simulated score.
              </p>
            </div>
            <span className="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-200">
              {proof.planStatus === "CHANGED" ? "Roadmap changed" :
                proof.planStatus === "UNCHANGED" ? "Justified no-change" : "Roadmap pending"}
            </span>
          </div>
          {proof.before && proof.after ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/15 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-wider text-slate-400">Estimate before</p>
                <p className="mt-2 text-xl font-semibold capitalize">{proof.before.level?.replaceAll("_"," ").toLowerCase() ?? "Unknown"}</p>
                <p className="mt-1 text-sm text-slate-300">Capability {proof.before.capability == null ? "unknown" : proof.before.capability.toFixed(2)}</p>
                <p className="mt-2 text-sm text-slate-300">Confidence {proof.before.confidencePercent == null ? "unknown" : proof.before.confidencePercent + "%"}</p>
              </div>
              <div className="rounded-xl border border-sky-400/40 bg-sky-400/10 p-4">
                <p className="text-xs uppercase tracking-wider text-sky-300">After assessed evidence</p>
                <p className="mt-2 text-xl font-semibold capitalize">{proof.after.level?.replaceAll("_"," ").toLowerCase() ?? "Unknown"}</p>
                <p className="mt-1 text-sm text-slate-200">Capability {proof.after.capability == null ? "unknown" : proof.after.capability.toFixed(2)}</p>
                <p className="mt-2 text-sm text-slate-200">Confidence {proof.after.confidencePercent == null ? "unknown" : proof.after.confidencePercent + "%"}</p>
              </div>
            </div>
          ) : <p className="mt-5 rounded-xl border border-amber-400/30 p-4 text-sm text-amber-200">
            Assessment saved; an assessment-linked skill-history change is not confirmed.
          </p>}
          <div className="mt-5 flex flex-wrap gap-4 border-t border-white/15 pt-4 text-sm">
            <span>Assessment score: <strong>{proof.scorePercent == null ? "not recorded" : proof.scorePercent + "%"}</strong></span>
            <span>Concept coverage: <strong>{proof.coveragePercent == null ? "not recorded" : proof.coveragePercent + "%"}</strong></span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            <strong className="text-white">Roadmap decision:</strong> {proof.planReason}
          </p>
          <Link href={("/challenge-my-twin?skillId=" + latestAssessment?.skill_id) as Route}
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-sky-300 underline underline-offset-4">
            Inspect the assessment-linked evidence →
          </Link>
        </section>
      ) : null}

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
