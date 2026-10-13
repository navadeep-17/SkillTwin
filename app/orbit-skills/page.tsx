import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OrbitSkillExperience, type OrbitSkill, type OrbitEvidence, type OrbitDependency } from "./orbit-skill-experience";
import { OrbitPreviewNav } from "@/components/orbit/orbit-preview-nav";
import "../orbit-lab/orbit-lab.css";
import "./orbit-skills.css";

type SkillRelation = { canonical_name?: string; category?: string | null; description?: string | null };
type RoleVersionRelation = { target_roles?: { name?: string } | Array<{ name?: string }> };
type Requirement = { id: string; skill_id: string; target_score: number; learning_stage: number; skills: SkillRelation | SkillRelation[] | null };
type Gap = { skill_id: string; status: string; gap_severity: number; priority_score: number; priority_band: string; recommended_action: string };
type Edge = { prerequisite_requirement_id: string; dependent_requirement_id: string; edge_type: "HARD" | "SOFT" };
type Evidence = { id: string; skill_id: string; source_type: string; claim: string | null; level_signal: string | null; status: string; created_at: string };
function one<T>(v: T | T[] | null | undefined): T | null { return Array.isArray(v) ? (v[0] ?? null) : (v ?? null); }
function labelStatus(v: string | null | undefined): OrbitSkill["status"] {
  return v === "STRONG" || v === "DEVELOPING" || v === "GAP" ? v : "UNKNOWN";
}
export const metadata = {
  title: "My Twin — Orbit Skill Constellation",
  description: "Explore real role dependencies, skill confidence, and supporting evidence in your SkillTwin."
};

export default async function OrbitSkillsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=%2Forbit-skills");

  const [goalResult, learnerResult] = await Promise.all([
    supabase.from("career_goals")
      .select("id,role_version_id,role_versions!inner(target_roles!inner(name))")
      .eq("user_id", auth.user.id).eq("status", "ACTIVE")
      .limit(1).maybeSingle(),
    supabase.from("user_skills")
      .select("skill_id,level_value,capability_score,confidence,evidence_count,source_family_count,conflict_state,last_validated_at")
      .eq("user_id", auth.user.id)
  ]);
  if (goalResult.error) throw goalResult.error;
  if (learnerResult.error) throw learnerResult.error;
  const goal = goalResult.data;
  const roleName = one(one(goal?.role_versions as RoleVersionRelation | RoleVersionRelation[] | null)?.target_roles)?.name ?? null;
  const roleVersionId = goal?.role_version_id ? String(goal.role_version_id) : null;

  let requirements: Requirement[] = [];
  let dependencies: Edge[] = [];
  let gaps: Gap[] = [];
  if (roleVersionId) {
    const [r, d, snapshotResult] = await Promise.all([
      supabase.from("role_skill_requirements")
        .select("id,skill_id,target_score,learning_stage,skills!inner(canonical_name,category,description)")
        .eq("role_version_id", roleVersionId),
      supabase.from("role_dependency_edges")
        .select("prerequisite_requirement_id,dependent_requirement_id,edge_type")
        .eq("role_version_id", roleVersionId),
      supabase.from("gap_snapshots")
        .select("id,created_at")
        .eq("user_id", auth.user.id)
        .eq("goal_id", goal!.id)
        .eq("role_version_id", roleVersionId)
        .order("created_at", { ascending: false })
        .limit(1).maybeSingle()
    ]);
    if (r.error) throw r.error;
    if (d.error) throw d.error;
    if (snapshotResult.error) throw snapshotResult.error;
    requirements = (r.data ?? []) as Requirement[];
    dependencies = (d.data ?? []) as Edge[];
    if (snapshotResult.data?.id) {
      const gapResult = await supabase.from("skill_gap_results")
        .select("skill_id,status,gap_severity,priority_score,priority_band,recommended_action")
        .eq("snapshot_id", snapshotResult.data.id);
      if (gapResult.error) throw gapResult.error;
      gaps = (gapResult.data ?? []) as Gap[];
    }
  }

  // Fetch only evidence associated with this role's requirements. The canonical
  // evidence count remains authoritative; this bounded list is for inspection.
  const roleSkillIds = [...new Set(requirements.map(req => String(req.skill_id)))];
  let evidence: Evidence[] = [];
  if (roleSkillIds.length) {
    const result = await supabase.from("skill_evidence")
      .select("id,skill_id,source_type,claim,level_signal,status,created_at")
      .eq("user_id", auth.user.id)
      .in("skill_id", roleSkillIds)
      .in("status", ["ACCEPTED", "NON_AGGREGATING"])
      .order("created_at", { ascending: false })
      .limit(300);
    if (result.error) throw result.error;
    evidence = (result.data ?? []) as Evidence[];
  }

  const learner = new Map((learnerResult.data ?? []).map(row => [String(row.skill_id), row]));
  const gapMap = new Map(gaps.map(row => [String(row.skill_id), row]));
  const evidenceMap = new Map<string, OrbitEvidence[]>();
  for (const item of evidence) {
    const key = String(item.skill_id);
    const list = evidenceMap.get(key) ?? [];
    list.push({
      id: String(item.id),
      sourceType: String(item.source_type),
      claim: item.claim == null ? null : String(item.claim),
      levelSignal: item.level_signal == null ? null : String(item.level_signal),
      status: item.status === "ACCEPTED" ? "ACCEPTED" : "NON_AGGREGATING",
      createdAt: item.created_at
    });
    evidenceMap.set(key, list);
  }

  const skills: OrbitSkill[] = requirements.map(req => {
    const meta = one(req.skills);
    const state = learner.get(String(req.skill_id));
    const gap = gapMap.get(String(req.skill_id));
    return {
      requirementId: String(req.id),
      skillId: String(req.skill_id),
      name: meta?.canonical_name ?? "Unnamed skill",
      category: meta?.category ?? null,
      description: meta?.description ?? null,
      stage: Number(req.learning_stage),
      target: Number(req.target_score),
      capability: state?.capability_score == null ? null : Number(state.capability_score),
      confidence: state?.confidence == null ? null : Number(state.confidence),
      evidenceCount: Number(state?.evidence_count ?? 0),
      sourceFamilyCount: Number(state?.source_family_count ?? 0),
      conflictState: state?.conflict_state == null ? null : String(state.conflict_state),
      lastValidated: state?.last_validated_at ?? null,
      status: labelStatus(gap?.status),
      priorityBand: gap?.priority_band ?? null,
      priorityScore: gap?.priority_score == null ? null : Number(gap.priority_score),
      gapSeverity: gap?.gap_severity == null ? null : Number(gap.gap_severity),
      action: gap?.recommended_action ?? null,
      evidence: evidenceMap.get(String(req.skill_id)) ?? []
    };
  });
  const graphEdges: OrbitDependency[] = dependencies.map(row => ({
    from: String(row.prerequisite_requirement_id),
    to: String(row.dependent_requirement_id),
    type: row.edge_type
  }));

  return (
    <main className="orbit-lab orbit-skills-page">
      <OrbitPreviewNav />
      <OrbitSkillExperience roleName={roleName} skills={skills} dependencies={graphEdges}/>
    </main>
  );
}
