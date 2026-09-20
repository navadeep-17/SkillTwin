import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  SkillGraph,
  type SkillGraphEdge,
  type SkillGraphNode
} from "@/components/skills/skill-graph";

type GapRow = {
  skill_id: string;
  target_score: number;
  gap_severity: number;
  priority_score: number;
  priority_band: string;
  recommended_action: string;
  status: "STRONG" | "DEVELOPING" | "GAP";
};

type RequirementRow = {
  id: string;
  skill_id: string;
  target_score: number;
  learning_stage: number;
  skills: {
    canonical_name?: string;
    category?: string | null;
  } | Array<{
    canonical_name?: string;
    category?: string | null;
  }> | null;
};

type DependencyRow = {
  prerequisite_requirement_id: string;
  dependent_requirement_id: string;
  edge_type: "HARD" | "SOFT";
};

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function SkillsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const [
    { data: userSkills, error: skillsError },
    { data: snapshot, error: snapshotError },
    { data: evidence, error: evidenceError },
    { data: activeGoal, error: goalError }
  ] = await Promise.all([
    supabase
      .from("user_skills")
      .select("skill_id,level_value,capability_score,confidence,conflict_state,evidence_count,source_family_count,last_evidence_at,last_validated_at,skills!inner(slug,canonical_name,category,description)")
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
      .from("skill_evidence")
      .select("id,skill_id,source_type,claim,level_signal,effective_weight,status,metadata,created_at")
      .eq("user_id", auth.user.id)
      .in("status", ["ACCEPTED","NON_AGGREGATING"])
      .order("created_at", { ascending: false })
      .limit(120),
    supabase
      .from("career_goals")
      .select("role_version_id,role_versions!inner(version,target_roles!inner(name))")
      .eq("user_id", auth.user.id)
      .eq("status", "ACTIVE")
      .limit(1)
      .maybeSingle()
  ]);

  for (const error of [skillsError, snapshotError, evidenceError, goalError]) {
    if (error) throw error;
  }

  let gaps: GapRow[] = [];
  if (snapshot?.id) {
    const { data, error } = await supabase
      .from("skill_gap_results")
      .select("skill_id,target_score,gap_severity,priority_score,priority_band,recommended_action,status")
      .eq("snapshot_id", snapshot.id);
    if (error) throw error;
    gaps = (data ?? []) as GapRow[];
  }

  const roleVersionId = activeGoal?.role_version_id ? String(activeGoal.role_version_id) : null;
  let requirements: RequirementRow[] = [];
  let dependencies: DependencyRow[] = [];

  if (roleVersionId) {
    const [requirementResult, edgeResult] = await Promise.all([
      supabase
        .from("role_skill_requirements")
        .select("id,skill_id,target_score,learning_stage,skills!inner(canonical_name,category)")
        .eq("role_version_id", roleVersionId),
      supabase
        .from("role_dependency_edges")
        .select("prerequisite_requirement_id,dependent_requirement_id,edge_type")
        .eq("role_version_id", roleVersionId)
    ]);

    if (requirementResult.error) throw requirementResult.error;
    if (edgeResult.error) throw edgeResult.error;
    requirements = (requirementResult.data ?? []) as RequirementRow[];
    dependencies = (edgeResult.data ?? []) as DependencyRow[];
  }

  const gapMap = new Map(gaps.map(gap => [gap.skill_id, gap]));
  const userSkillMap = new Map((userSkills ?? []).map(skill => [String(skill.skill_id), skill]));
  const evidenceMap = new Map<string, typeof evidence>();

  for (const item of evidence ?? []) {
    const currentItems = evidenceMap.get(item.skill_id) ?? [];
    currentItems.push(item);
    evidenceMap.set(item.skill_id, currentItems);
  }

  const roleVersion = relationOne(activeGoal?.role_versions as
    | { version?: number; target_roles?: { name?: string } | Array<{ name?: string }> }
    | Array<{ version?: number; target_roles?: { name?: string } | Array<{ name?: string }> }>
    | null);
  const role = relationOne(roleVersion?.target_roles);
  const roleName = role?.name ?? "Target role";

  const graphNodes: SkillGraphNode[] = requirements.map(requirement => {
    const skill = relationOne(requirement.skills);
    const current = userSkillMap.get(String(requirement.skill_id));
    const gap = gapMap.get(String(requirement.skill_id));
    return {
      requirementId: String(requirement.id),
      skillId: String(requirement.skill_id),
      name: skill?.canonical_name ?? "Skill",
      category: skill?.category ?? null,
      stage: Number(requirement.learning_stage),
      targetScore: Number(requirement.target_score),
      capabilityScore: current?.capability_score == null ? null : Number(current.capability_score),
      confidence: Number(current?.confidence ?? 0),
      priorityBand: gap?.priority_band ?? null,
      gapSeverity: gap == null ? null : Number(gap.gap_severity),
      status: gap?.status ?? (current ? "DEVELOPING" : "UNKNOWN")
    };
  });

  const graphEdges: SkillGraphEdge[] = dependencies.map(edge => ({
    prerequisiteRequirementId: String(edge.prerequisite_requirement_id),
    dependentRequirementId: String(edge.dependent_requirement_id),
    edgeType: edge.edge_type
  }));

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">SkillTwin</p>
        <h1 className="mt-2 text-3xl font-semibold">Skill Graph + evidence matrix</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          See the {roleName} competency structure, then inspect the evidence that produced each capability estimate.
          Capability, confidence, role target, and priority remain separate signals.
        </p>
      </header>

      {requirements.length ? (
        <SkillGraph roleName={roleName} items={graphNodes} dependencies={graphEdges} />
      ) : (
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Choose a target role to build the competency graph.
        </section>
      )}

      <section className="mt-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Evidence Matrix</p>
          <h2 className="mt-1 text-2xl font-semibold">Your persistent learner state</h2>
        </div>

        {!userSkills?.length ? (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            No skill state exists yet. Analyze your resume first.
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {userSkills.map(skill => {
              const meta = relationOne(skill.skills as
                | { canonical_name?: string; category?: string; description?: string; slug?: string }
                | Array<{ canonical_name?: string; category?: string; description?: string; slug?: string }>
                | null);
              const gap = gapMap.get(skill.skill_id);
              const items = evidenceMap.get(skill.skill_id) ?? [];
              const confidence = Math.round(Number(skill.confidence) * 100);
              const gapPercent = gap ? Math.round(Number(gap.gap_severity) * 100) : null;

              return (
                <details
                  id={"skill-" + skill.skill_id}
                  key={skill.skill_id}
                  className="group scroll-mt-24 rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <summary className="cursor-pointer list-none p-5">
                    <div className="grid gap-4 md:grid-cols-[1.3fr_.7fr_.7fr_.7fr] md:items-center">
                      <div>
                        <p className="font-semibold">{meta?.canonical_name ?? "Skill"}</p>
                        <p className="mt-1 text-sm text-slate-500">{meta?.category ?? ""}</p>
                      </div>
                      <Mini label="Capability" value={String(skill.level_value)} />
                      <Mini label="Confidence" value={confidence + "%"} />
                      <Mini
                        label="Role gap"
                        value={gapPercent == null ? "—" : gapPercent + "%"}
                      />
                    </div>
                  </summary>

                  <div className="border-t border-slate-200 p-5">
                    <div className="grid gap-4 md:grid-cols-4">
                      <Metric label="Capability score" value={skill.capability_score == null ? "Unknown" : Number(skill.capability_score).toFixed(2) + " / 4"} />
                      <Metric label="Target score" value={gap ? Number(gap.target_score).toFixed(2) + " / 4" : "—"} />
                      <Metric label="Priority" value={gap ? String(gap.priority_band) : "—"} />
                      <Metric label="Next action" value={gap ? String(gap.recommended_action) : "—"} />
                    </div>

                    <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.5fr]">
                      <div>
                        <h3 className="font-semibold">Why it matters</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {meta?.description ?? "This skill contributes to the target-role competency model."}
                        </p>
                        <div className="mt-4 space-y-1 text-sm text-slate-500">
                          <p>{skill.evidence_count} evidence items across {skill.source_family_count} source families</p>
                          <p>Conflict: {skill.conflict_state}</p>
                          <p>Last validated: {skill.last_validated_at ? new Date(skill.last_validated_at).toLocaleDateString() : "Not yet"}</p>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-semibold">Evidence found</h3>
                        <div className="mt-3 space-y-2">
                          {items.length ? items.slice(0, 8).map(item => (
                            <div key={item.id} className="rounded-xl bg-slate-50 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs font-semibold uppercase tracking-wide text-brand-600">{item.source_type}</span>
                                <span className="text-xs text-slate-500">Weight {Number(item.effective_weight).toFixed(2)}</span>
                              </div>
                              <p className="mt-2 text-sm leading-6 text-slate-700">{item.claim}</p>
                            </div>
                          )) : (
                            <p className="text-sm text-slate-500">No evidence rows available.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
