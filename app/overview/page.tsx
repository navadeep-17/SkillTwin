import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function OverviewPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const [
    { data: skills, error: skillsError },
    { data: snapshot, error: snapshotError },
    { data: activity, error: activityError },
    { data: goal, error: goalError }
  ] = await Promise.all([
    supabase
      .from("user_skills")
      .select("skill_id,level_value,capability_score,confidence,conflict_state,evidence_count,last_validated_at,skills!inner(slug,canonical_name,category)")
      .eq("user_id", auth.user.id)
      .order("confidence", { ascending: false }),
    supabase
      .from("gap_snapshots")
      .select("id,readiness,evidence_coverage,created_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("agent_events")
      .select("id,event_type,summary,created_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("career_goals")
      .select("id,role_versions!inner(version,target_roles!inner(name,slug,family))")
      .eq("user_id", auth.user.id)
      .eq("status", "ACTIVE")
      .limit(1)
      .maybeSingle()
  ]);

  if (skillsError) throw skillsError;
  if (snapshotError) throw snapshotError;
  if (activityError) throw activityError;
  if (goalError) throw goalError;

  const roleVersion = goal?.role_versions as {
    version?: number;
    target_roles?: { name?: string; slug?: string; family?: string | null } | Array<{ name?: string; slug?: string; family?: string | null }>;
  } | null;
  const targetRole = Array.isArray(roleVersion?.target_roles)
    ? roleVersion?.target_roles[0]
    : roleVersion?.target_roles;
  const roleName = targetRole?.name ?? "Target role";
  const roleVersionNumber = roleVersion?.version ?? 1;

  let gaps: Array<Record<string, unknown>> = [];
  if (snapshot?.id) {
    const { data, error } = await supabase
      .from("skill_gap_results")
      .select("id,skill_id,current_score,current_confidence,target_score,gap_severity,priority_score,priority_band,status,recommended_action,reason_codes,skills!inner(slug,canonical_name,category)")
      .eq("snapshot_id", snapshot.id)
      .order("priority_score", { ascending: false })
      .limit(6);
    if (error) throw error;
    gaps = data ?? [];
  }

  if (!skills?.length && !snapshot) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">SkillTwin</p>
        <h1 className="mt-2 text-3xl font-semibold">Your SkillTwin needs evidence</h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Choose your target role and upload your resume to build the first evidence-backed skill state and career gap analysis.
        </p>
        <Link
          href="/onboarding"
          className="mt-6 inline-flex rounded-xl bg-brand-600 px-5 py-2.5 font-medium text-white"
        >
          Analyze my resume
        </Link>
      </main>
    );
  }

  const strongSkills = (skills ?? []).filter(skill => skill.level_value !== "UNKNOWN").length;
  const avgConfidence = skills?.length
    ? Math.round(100 * skills.reduce((sum, skill) => sum + Number(skill.confidence ?? 0), 0) / skills.length)
    : 0;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">
            {roleName} · Live SkillTwin
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Your current learning state</h1>
          <p className="mt-2 text-slate-600">
            Every number below comes from persisted evidence, not frontend calculation.
          </p>
        </div>
        <Link href="/onboarding" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium">
          Add profile evidence
        </Link>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Career readiness" value={snapshot ? String(snapshot.readiness) + "%" : "—"} detail={"Target: " + roleName + " v" + roleVersionNumber} />
        <Metric label="Evidence coverage" value={snapshot ? String(snapshot.evidence_coverage) + "%" : "—"} detail="Separate from capability" />
        <Metric label="Skills with evidence" value={String(strongSkills)} detail={String(skills?.length ?? 0) + " SkillTwin rows"} />
        <Metric label="Average confidence" value={String(avgConfidence) + "%"} detail="Confidence is not capability" />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Priority gaps</p>
              <h2 className="mt-1 text-xl font-semibold">What SkillTwin recommends next</h2>
            </div>
            <span className="text-sm text-slate-500">{gaps.length} shown</span>
          </div>

          <div className="mt-5 space-y-3">
            {gaps.length ? gaps.map(gap => {
              const skill = gap.skills as { canonical_name?: string; category?: string } | null;
              return (
                <div key={String(gap.id)} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{skill?.canonical_name ?? "Skill"}</p>
                      <p className="mt-1 text-sm text-slate-500">{skill?.category ?? ""}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">
                      {String(gap.priority_band)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
                    <span>Action: {String(gap.recommended_action)}</span>
                    <span>Gap: {Math.round(Number(gap.gap_severity) * 100)}%</span>
                    <span>Confidence: {Math.round(Number(gap.current_confidence) * 100)}%</span>
                  </div>
                </div>
              );
            }) : (
              <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                No gap snapshot yet. Add evidence or recompute your role analysis.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Agent activity</p>
          <h2 className="mt-1 text-xl font-semibold">Why your state changed</h2>
          <div className="mt-5 space-y-4">
            {activity?.length ? activity.map(event => (
              <div key={event.id} className="border-l-2 border-indigo-200 pl-3">
                <p className="text-sm font-medium">{event.summary}</p>
                <p className="mt-1 text-xs text-slate-500">{new Date(event.created_at).toLocaleString()}</p>
              </div>
            )) : (
              <p className="text-sm text-slate-500">No agent events yet.</p>
            )}
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Skill matrix</p>
        <h2 className="mt-1 text-xl font-semibold">Capability and confidence</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(skills ?? []).map(skill => {
            const meta = skill.skills as { canonical_name?: string; category?: string } | null;
            return (
              <div key={skill.skill_id} className="rounded-xl border border-slate-200 p-4">
                <p className="font-semibold">{meta?.canonical_name ?? "Skill"}</p>
                <p className="mt-1 text-xs text-slate-500">{meta?.category ?? ""}</p>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-500">Capability</p>
                    <p className="font-medium">{skill.level_value}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Confidence</p>
                    <p className="font-medium">{Math.round(Number(skill.confidence) * 100)}%</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{detail}</p>
    </div>
  );
}
