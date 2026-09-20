import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronDown, Database, Network, ShieldCheck, Target } from "lucide-react";
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

  const evidenceRows = evidence?.length ?? 0;
  const knownSkills = (userSkills ?? []).filter(skill => skill.level_value !== "UNKNOWN").length;
  const highConfidence = (userSkills ?? []).filter(skill => Number(skill.confidence ?? 0) >= 0.7).length;

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="mb-7 flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-3xl">
          <p className="eyebrow">Your SkillTwin</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.025em] text-slate-950">
            Skills, evidence, and role dependencies.
          </h1>
          <p className="mt-3 text-[15px] leading-7 text-slate-600">
            Explore the {roleName} competency graph, then inspect the evidence behind each learner-state estimate.
            Capability, confidence, target level, and priority stay intentionally separate.
          </p>
        </div>
        <Link href="/onboarding" className="btn-secondary">
          Add evidence
        </Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <SummaryMetric icon={Network} label="Skills observed" value={String(userSkills?.length ?? 0)} detail={knownSkills + " with usable capability evidence"} />
        <SummaryMetric icon={ShieldCheck} label="High-confidence skills" value={String(highConfidence)} detail="Confidence ≥ 70%" />
        <SummaryMetric icon={Database} label="Evidence records" value={String(evidenceRows)} detail="Accepted or non-aggregating observations"} />
      </section>

      {requirements.length ? (
        <SkillGraph roleName={roleName} items={graphNodes} dependencies={graphEdges} />
      ) : (
        <section className="surface-card mt-8 p-6">
          <div className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Target className="size-5" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">Choose a target role to build the competency graph</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
            The graph is role-relative. Once a target is active, SkillTwin can place your current capability against its prerequisite structure.
          </p>
          <Link href="/onboarding" className="btn-primary mt-5">Set target role</Link>
        </section>
      )}

      <section className="mt-9">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Evidence matrix</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Persistent learner state</h2>
            <p className="mt-2 text-sm text-slate-500">Open a skill to see its current estimate, role target, and supporting evidence.</p>
          </div>
          {snapshot ? (
            <div className="text-right text-xs text-slate-400">
              <p>Readiness {Math.round(Number(snapshot.readiness ?? 0))}%</p>
              <p className="mt-1">Coverage {Math.round(Number(snapshot.evidence_coverage ?? 0))}%</p>
            </div>
          ) : null}
        </div>

        {!userSkills?.length ? (
          <div className="surface-card mt-5 p-6">
            <p className="text-sm text-slate-600">No canonical skill state exists yet. Analyze your profile to create evidence-backed estimates.</p>
            <Link href="/onboarding" className="btn-primary mt-4">Analyze profile</Link>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {userSkills.map(skill => {
              const meta = relationOne(skill.skills as
                | { canonical_name?: string; category?: string; description?: string; slug?: string }
                | Array<{ canonical_name?: string; category?: string; description?: string; slug?: string }>
                | null);
              const gap = gapMap.get(skill.skill_id);
              const items = evidenceMap.get(skill.skill_id) ?? [];
              const confidence = Math.round(Number(skill.confidence) * 100);
              const gapPercent = gap ? Math.round(Number(gap.gap_severity) * 100) : null;
              const tone = skillTone(gap?.status, skill.level_value);

              return (
                <details
                  id={"skill-" + skill.skill_id}
                  key={skill.skill_id}
                  className="group surface-card scroll-mt-24 overflow-hidden"
                >
                  <summary className="cursor-pointer list-none px-5 py-4 sm:px-6">
                    <div className="grid gap-4 md:grid-cols-[1.4fr_.65fr_.65fr_.65fr_auto] md:items-center">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={"size-2.5 shrink-0 rounded-full " + tone.dot} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{meta?.canonical_name ?? "Skill"}</p>
                          <p className="mt-0.5 truncate text-xs text-slate-400">{meta?.category ?? ""}</p>
                        </div>
                      </div>
                      <Mini label="Capability" value={humanize(String(skill.level_value))} />
                      <Mini label="Confidence" value={confidence + "%"} />
                      <Mini label="Role gap" value={gapPercent == null ? "—" : gapPercent + "%"} />
                      <ChevronDown className="size-4 text-slate-400 transition-transform duration-200 group-open:rotate-180" />
                    </div>
                  </summary>

                  <div className="border-t border-slate-100 bg-slate-50/45 p-5 sm:p-6">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <Metric label="Capability score" value={skill.capability_score == null ? "Unknown" : Number(skill.capability_score).toFixed(2) + " / 4"} />
                      <Metric label="Target score" value={gap ? Number(gap.target_score).toFixed(2) + " / 4" : "—"} />
                      <Metric label="Priority" value={gap ? humanize(String(gap.priority_band)) : "—"} />
                      <Metric label="Next action" value={gap ? humanize(String(gap.recommended_action)) : "—"} />
                    </div>

                    <div className="mt-5 grid gap-5 xl:grid-cols-[.75fr_1.25fr]">
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <h3 className="text-sm font-semibold text-slate-900">Why it matters</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {meta?.description ?? "This skill contributes to the active target-role competency model."}
                        </p>
                        <div className="mt-4 space-y-2 text-xs text-slate-500">
                          <p>{skill.evidence_count} evidence items across {skill.source_family_count} source families</p>
                          <p>Conflict state · {humanize(String(skill.conflict_state))}</p>
                          <p>Last validated · {skill.last_validated_at ? new Date(skill.last_validated_at).toLocaleDateString() : "Not yet"}</p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="text-sm font-semibold text-slate-900">Evidence found</h3>
                          <span className="text-xs text-slate-400">{items.length} shown</span>
                        </div>
                        <div className="mt-3 space-y-2">
                          {items.length ? items.slice(0, 8).map(item => (
                            <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-600">{humanize(item.source_type)}</span>
                                <span className="text-xs text-slate-400">Weight {Number(item.effective_weight).toFixed(2)}</span>
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

function SummaryMetric({
  icon: Icon,
  label,
  value,
  detail
}: {
  icon: typeof Network;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="surface-card flex items-start gap-3 p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <Icon className="size-4.5" />
      </span>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-0.5 text-xl font-semibold tracking-tight text-slate-950">{value}</p>
        <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-700">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1.5 font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function skillTone(status: GapRow["status"] | undefined, level: string) {
  if (status === "STRONG") return { dot: "bg-emerald-500" };
  if (status === "GAP") return { dot: "bg-rose-500" };
  if (status === "DEVELOPING") return { dot: "bg-amber-500" };
  if (level === "UNKNOWN") return { dot: "bg-slate-300" };
  return { dot: "bg-brand-400" };
}

function humanize(value: string) {
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase());
}
