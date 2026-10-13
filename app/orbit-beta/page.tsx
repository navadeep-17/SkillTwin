import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OrbitTodayLive, type OrbitTodayModel } from "./orbit-today-live";
import "../orbit-lab/orbit-lab.css";
import "./orbit-beta.css";

type SkillMeta = { canonical_name?: string; category?: string | null };
type RoleLink = { name?: string };
type RoleVersionLink = { target_roles?: RoleLink | RoleLink[] };
type Requirement = {
  id: string; skill_id: string; target_score: number; learning_stage: number;
  skills: SkillMeta | SkillMeta[] | null;
};
type Gap = {
  skill_id: string; status: string; priority_band: string; recommended_action: string;
  priority_score: number; gap_severity: number;
};
type Dependency = {
  prerequisite_requirement_id: string;
  dependent_requirement_id: string;
  edge_type: "HARD" | "SOFT";
};
function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}
const allowedStatus = (value: string): OrbitTodayModel["nodes"][number]["status"] =>
  value === "STRONG" || value === "DEVELOPING" || value === "GAP" ? value : "UNKNOWN";

export const metadata = {
  title: "SkillTwin Orbit — Live Today Preview",
  description: "Authenticated read-only preview of the Orbit Today experience using canonical learner state."
};

export default async function OrbitBetaPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=%2Forbit-beta");

  const [
    { data: goal, error: goalError },
    { data: snapshot, error: snapshotError },
    { data: skills, error: skillsError }
  ] = await Promise.all([
    supabase.from("career_goals")
      .select("role_version_id,role_versions!inner(target_roles!inner(name))")
      .eq("user_id", auth.user.id).eq("status", "ACTIVE")
      .limit(1).maybeSingle(),
    supabase.from("gap_snapshots")
      .select("id,readiness,evidence_coverage,created_at")
      .eq("user_id", auth.user.id).order("created_at", { ascending: false })
      .limit(1).maybeSingle(),
    supabase.from("user_skills")
      .select("skill_id,level_value,capability_score,confidence,evidence_count")
      .eq("user_id", auth.user.id)
  ]);
  for (const e of [goalError, snapshotError, skillsError]) if (e) throw e;

  const roleVersion = one(goal?.role_versions as RoleVersionLink | RoleVersionLink[] | null);
  const roleName = one(roleVersion?.target_roles)?.name ?? null;
  const roleVersionId = goal?.role_version_id ? String(goal.role_version_id) : null;
  let requirements: Requirement[] = [];
  let dependencies: Dependency[] = [];
  let gaps: Gap[] = [];

  if (roleVersionId) {
    const [r, d] = await Promise.all([
      supabase.from("role_skill_requirements")
        .select("id,skill_id,target_score,learning_stage,skills!inner(canonical_name,category)")
        .eq("role_version_id", roleVersionId),
      supabase.from("role_dependency_edges")
        .select("prerequisite_requirement_id,dependent_requirement_id,edge_type")
        .eq("role_version_id", roleVersionId)
    ]);
    if (r.error) throw r.error;
    if (d.error) throw d.error;
    requirements = (r.data ?? []) as Requirement[];
    dependencies = (d.data ?? []) as Dependency[];
  }
  if (snapshot?.id) {
    const g = await supabase.from("skill_gap_results")
      .select("skill_id,status,priority_band,recommended_action,priority_score,gap_severity")
      .eq("snapshot_id", snapshot.id)
      .order("priority_score", { ascending: false });
    if (g.error) throw g.error;
    gaps = (g.data ?? []) as Gap[];
  }
  const skillsById = new Map((skills ?? []).map(s => [String(s.skill_id), s]));
  const gapsById = new Map(gaps.map(g => [String(g.skill_id), g]));
  const nodes: OrbitTodayModel["nodes"] = requirements.map(req => {
    const meta = one(req.skills);
    const state = skillsById.get(String(req.skill_id));
    const gap = gapsById.get(String(req.skill_id));
    return {
      id: String(req.id),
      skillId: String(req.skill_id),
      name: meta?.canonical_name ?? "Skill",
      status: allowedStatus(gap?.status ?? "UNKNOWN"),
      capability: state?.capability_score == null ? null : Number(state.capability_score),
      confidence: state?.confidence == null ? null : Number(state.confidence),
      evidenceCount: Number(state?.evidence_count ?? 0),
      target: Number(req.target_score),
      stage: Number(req.learning_stage)
    };
  });
  const model: OrbitTodayModel = {
    roleName,
    readiness: snapshot?.readiness == null ? null : Number(snapshot.readiness),
    coverage: snapshot?.evidence_coverage == null ? null : Number(snapshot.evidence_coverage),
    lastUpdated: snapshot?.created_at ?? null,
    nodes,
    dependencies: dependencies.map(d => ({
      from: String(d.prerequisite_requirement_id),
      to: String(d.dependent_requirement_id),
      type: d.edge_type
    })),
    priorities: gaps.filter(g => g.status !== "STRONG").slice(0, 4).map(g => ({
      skillId: String(g.skill_id),
      name: nodes.find(n => n.skillId === String(g.skill_id))?.name ?? "Skill",
      action: String(g.recommended_action ?? "REVIEW"),
      band: String(g.priority_band ?? "")
    }))
  };

  return (
    <div className="orbit-beta-shell">
      <div className="orbit-beta-utility">
        <span>Orbit · Authenticated preview</span>
        <Link href="/overview">Return to current SkillTwin →</Link>
      </div>
      <OrbitTodayLive model={model} />
    </div>
  );
}
