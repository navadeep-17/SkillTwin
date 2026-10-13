import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight, BookOpenCheck, ClipboardCheck, Compass, FileCheck2,
  Info, LockKeyhole, ShieldAlert, Target, TrendingUp
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PassportActions } from "@/components/passport/passport-actions";

export const dynamic = "force-dynamic";

type NameRelation = { canonical_name?: string };
type RoleRelation = {
  version?: number;
  target_roles?: { name?: string } | { name?: string }[];
};
type EvidenceRow = { skill_id: string; source_type: string; status: string };

function first<T>(item: T | T[] | null | undefined): T | null {
  return Array.isArray(item) ? (item[0] ?? null) : (item ?? null);
}

function safePercent(value: unknown): string {
  const number = Number(value);
  return value == null || !Number.isFinite(number)
    ? "Not available"
    : Math.round(Math.max(0, Math.min(100, number))) + "%";
}

function confidencePercent(value: unknown): string {
  const number = Number(value);
  return value == null || !Number.isFinite(number)
    ? "Unknown"
    : safePercent(number * 100);
}

function humanize(value: string): string {
  return value.toLowerCase().replace(/_/g, " ").replace(/\\b\\w/g, char => char.toUpperCase());
}

function readableSource(value: string): string {
  const labels: Record<string, string> = {
    MANUAL_SELF_REPORT: "Self-reported",
    RESUME_SKILL_MENTION: "Resume mention",
    RESUME_PROJECT_DETAIL: "Resume project",
    LEARNING_TASK_COMPLETED: "Learning task",
    PRACTICE_EVALUATED: "Evaluated practice",
    ASSESSMENT_QUESTION: "Assessment question",
    ASSESSMENT_SUMMARY: "Assessment result",
    PROJECT_DESCRIPTION: "Project description",
    PROJECT_ARTIFACT_VERIFIED: "Reviewed project artifact"
  };
  return labels[value] ?? humanize(value);
}

export default async function PassportPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const userId = auth.user.id;

  const { data: goal, error: goalError } = await supabase
    .from("career_goals")
    .select("id,target_date,role_versions!inner(version,target_roles!inner(name))")
    .eq("user_id", userId)
    .eq("status", "ACTIVE")
    .limit(1)
    .maybeSingle();
  if (goalError) throw goalError;

  if (!goal) {
    return (
      <main className="passport-document mx-auto max-w-5xl px-5 py-10 sm:px-6">
        <section className="surface-card p-8 sm:p-12">
          <Compass className="size-9 text-brand-600" />
          <h1 className="mt-5 text-3xl font-semibold tracking-tight">Your Career Evidence Passport</h1>
          <p className="mt-3 max-w-xl leading-7 text-slate-600">
            Choose a career goal and add evidence before SkillTwin can assemble a role-specific report.
            Unknown capability is never treated as a zero score.
          </p>
          <Link href="/onboarding" className="btn-primary mt-6">
            Set up my career goal <ArrowRight className="size-4" />
          </Link>
        </section>
      </main>
    );
  }

  const [
    { data: snapshot, error: snapshotError },
    { data: skillRows, error: skillError },
    { data: evidenceRows, error: evidenceError },
    { data: assessmentRows, error: assessmentError }
  ] = await Promise.all([
    supabase.from("gap_snapshots")
      .select("id,readiness,evidence_coverage,role_version_id,created_at")
      .eq("user_id", userId)
      .eq("goal_id", goal.id)
      .order("created_at", { ascending: false })
      .limit(1).maybeSingle(),
    supabase.from("user_skills")
      .select("skill_id,level_value,capability_score,confidence,conflict_state,evidence_count,last_validated_at,skills!inner(canonical_name)")
      .eq("user_id", userId),
    supabase.from("skill_evidence")
      .select("skill_id,source_type,status")
      .eq("user_id", userId)
      .in("status", ["ACCEPTED", "NON_AGGREGATING"])
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("skill_assessment_outcomes")
      .select("id,normalized_score,coverage,created_at,skills!inner(canonical_name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(6)
  ]);
  for (const error of [snapshotError, skillError, evidenceError, assessmentError]) {
    if (error) throw error;
  }

  const { data: gapRows, error: gapError } = snapshot
    ? await supabase.from("skill_gap_results")
        .select("id,skill_id,status,priority_band,gap_severity,recommended_action,skills!inner(canonical_name)")
        .eq("snapshot_id", snapshot.id)
        .eq("user_id", userId)
        .order("priority_score", { ascending: false })
        .limit(8)
    : { data: [], error: null };
  if (gapError) throw gapError;

  const roleVersion = first(goal.role_versions as RoleRelation | RoleRelation[] | null);
  const role = first(roleVersion?.target_roles);
  const roleName = role?.name ?? "Selected career";
  const evidence = (evidenceRows ?? []) as EvidenceRow[];
  const evidenceBySkill = new Map<string, string[]>();
  for (const item of evidence) {
    const values = evidenceBySkill.get(item.skill_id) ?? [];
    if (!values.includes(item.source_type)) values.push(item.source_type);
    evidenceBySkill.set(item.skill_id, values);
  }
  const knownSkills = (skillRows ?? []).filter(item => item.level_value !== "UNKNOWN");
  const unresolved = (skillRows ?? []).filter(item => item.conflict_state === "UNRESOLVED");
  const name = String(auth.user.user_metadata?.full_name ?? auth.user.email?.split("@")[0] ?? "Learner");
  const displayDate = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return (
    <main className="passport-document mx-auto max-w-6xl px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="passport-actions mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href="/progress" className="quiet-link">← Back to progress</Link>
        <PassportActions />
      </div>

      <section className="surface-card overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/80 p-6 sm:p-9">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="eyebrow">Personal and private · SkillTwin</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Career Evidence Passport</h1>
              <p className="mt-3 text-slate-600">Prepared for {name} · {displayDate}</p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
              <LockKeyhole className="size-4 text-brand-600" /> Private report
            </span>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-800 ring-1 ring-slate-200">
              <Target className="mr-2 inline size-4 text-brand-600" /> {roleName}
            </span>
            <span className="rounded-lg bg-white px-3 py-2 text-sm text-slate-600 ring-1 ring-slate-200">
              Role model v{roleVersion?.version ?? "—"}
            </span>
            {goal.target_date ? (
              <span className="rounded-lg bg-white px-3 py-2 text-sm text-slate-600 ring-1 ring-slate-200">
                Goal date {String(goal.target_date)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="p-6 sm:p-9">
          <div className="grid gap-4 sm:grid-cols-3">
            <Metric icon={TrendingUp} label="Role readiness" value={snapshot ? safePercent(snapshot.readiness) : "Not assessed"} detail="Model-based guidance, not hiring probability" />
            <Metric icon={FileCheck2} label="Evidence coverage" value={snapshot ? safePercent(snapshot.evidence_coverage) : "Not assessed"} detail="Coverage of target-role requirements" />
            <Metric icon={BookOpenCheck} label="Skills with estimated level" value={String(knownSkills.length)} detail="Self-reports, activities and assessments vary in strength" />
          </div>
          <p className="mt-4 text-xs leading-6 text-slate-500">
            {snapshot
              ? "Role metrics last calculated " + new Date(snapshot.created_at).toLocaleString("en-IN") + ". Skill evidence below reflects the latest saved learner state."
              : "No role-specific analysis exists yet; SkillTwin is not displaying an invented readiness score."}
          </p>

          <div className="mt-9 grid gap-8 lg:grid-cols-[1.15fr_.85fr]">
            <section>
              <div className="flex items-center gap-2"><ShieldAlert className="size-5 text-brand-600" />
                <h2 className="text-xl font-semibold text-slate-900">Capability and confidence</h2>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Skill level describes the current estimate. Confidence describes how certain that estimate is. A resume mention is not a verified competency.
              </p>
              <div className="mt-4 space-y-3">
                {skillRows?.length ? skillRows.slice()
                  .sort((a, b) => Number(b.confidence) - Number(a.confidence))
                  .slice(0, 12)
                  .map(item => {
                    const skill = first(item.skills as NameRelation | NameRelation[] | null);
                    const sources = evidenceBySkill.get(item.skill_id) ?? [];
                    return (
                      <article key={item.skill_id} className="rounded-xl border border-slate-200 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-slate-900">{skill?.canonical_name ?? "Skill"}</p>
                          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                            {humanize(item.level_value)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">Confidence: <strong>{confidencePercent(item.confidence)}</strong> · {item.evidence_count} evidence item(s)</p>
                        <p className="mt-1.5 text-xs leading-5 text-slate-500">
                          Sources: {sources.length ? sources.map(readableSource).join(", ") : "No currently accepted source listed"}
                        </p>
                        {item.conflict_state === "UNRESOLVED" ? (
                          <p className="mt-2 text-xs font-semibold text-amber-700">Conflicting evidence needs review</p>
                        ) : null}
                      </article>
                    );
                  }) : (
                    <div className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
                      No skills recorded yet. <Link className="font-semibold text-brand-600" href="/onboarding">Add evidence</Link>.
                    </div>
                  )}
              </div>
              {skillRows && skillRows.length > 12 ? (
                <p className="mt-3 text-xs text-slate-500">Showing 12 of {skillRows.length} skills. View the complete record in Skills.</p>
              ) : null}
            </section>

            <div className="space-y-8">
              <section>
                <h2 className="text-xl font-semibold text-slate-900">Priority development areas</h2>
                <p className="mt-2 text-sm text-slate-500">From the latest analysis of your active target role.</p>
                <div className="mt-4 space-y-3">
                  {gapRows?.length ? gapRows.map(gap => {
                    const skill = first(gap.skills as NameRelation | NameRelation[] | null);
                    return (
                      <div className="rounded-xl border border-slate-200 p-4" key={gap.id}>
                        <p className="font-semibold text-slate-900">{skill?.canonical_name ?? "Skill"}</p>
                        <p className="mt-1.5 text-xs text-slate-500">
                          {humanize(gap.status)} · {humanize(gap.priority_band)} priority · {humanize(gap.recommended_action)}
                        </p>
                      </div>
                    );
                  }) : (
                    <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No role-gap snapshot is available yet.</div>
                  )}
                </div>
              </section>
              <section>
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="size-5 text-brand-600"/>
                  <h2 className="text-xl font-semibold text-slate-900">Recent assessment results</h2>
                </div>
                <p className="mt-2 text-sm text-slate-500">SkillTwin assessments are learning signals, not third-party certifications.</p>
                <div className="mt-4 space-y-3">
                  {assessmentRows?.length ? assessmentRows.map(item => {
                    const skill = first(item.skills as NameRelation | NameRelation[] | null);
                    return (
                      <article key={item.id} className="rounded-xl border border-slate-200 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-slate-900">{skill?.canonical_name ?? "Assessment"}</p>
                          <p className="font-semibold text-brand-700">{safePercent(Number(item.normalized_score) * 100)}</p>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          {new Date(item.created_at).toLocaleDateString("en-IN")} · Content coverage {safePercent(Number(item.coverage) * 100)}
                        </p>
                      </article>
                    );
                  }) : (
                    <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No completed assessment results yet.</div>
                  )}
                </div>
              </section>
            </div>
          </div>

          <section className="mt-9 rounded-xl border border-amber-200 bg-amber-50/70 p-5">
            <div className="flex items-center gap-2 font-semibold text-amber-900">
              <Info className="size-4" /> Important limitations
            </div>
            <p className="mt-2 text-sm leading-6 text-amber-950/80">
              This report is private, learner-controlled guidance generated from available evidence. It is not a credential, proof of employment eligibility, independent validation of projects, or a guarantee of job readiness.
              Unrecorded abilities remain unknown. Estimates can change when new evidence is accepted.
              {unresolved.length ? " " + unresolved.length + " skills currently have unresolved evidence conflicts." : ""}
            </p>
          </section>
          <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <span>SkillTwin · Private learner evidence snapshot</span>
            <span>Generated {displayDate} · Not independently certified</span>
          </footer>
        </div>
      </section>
      <nav className="passport-actions mt-5 flex flex-wrap gap-3">
        <Link href="/skills" className="btn-secondary">Inspect complete skill evidence</Link>
        <Link href="/practice" className="btn-primary">Validate a skill <ArrowRight className="size-4" /></Link>
      </nav>
    </main>
  );
}

function Metric({ icon: Icon, label, value, detail }: {
  icon: typeof TrendingUp; label: string; value: string; detail: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <Icon className="size-4 text-brand-600"/> {label}
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}
