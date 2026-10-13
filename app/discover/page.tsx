import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CareerDiscovery } from "@/components/discovery/career-discovery";
import type { DiscoverableRole } from "@/components/discovery/career-discovery";

export const dynamic = "force-dynamic";

type RoleMeta = {
  id?: string;
  name?: string;
  slug?: string;
  family?: string | null;
  owner_user_id?: string | null;
};
type RequirementSkill = {
  canonical_name?: string;
  category?: string;
};
type RequirementGroup = {
  name?: string;
  group_type?: string;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

/**
 * Discovery is deliberately read-only. A role profile is not a prediction of
 * occupational fit or a guarantee that a user meets hiring requirements.
 *
 * Supabase RLS filters private AI-generated roles to the creator.
 */
export default async function DiscoverCareersPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const [{ data: versions, error: rolesError }, { data: knownSkills, error: skillsError }] =
    await Promise.all([
      supabase.from("role_versions")
        .select("id,role_id,version,source,target_roles!inner(id,name,slug,family,owner_user_id)")
        .eq("status", "ACTIVE")
        .order("version", { ascending: false }),
      supabase.from("user_skills")
        .select("skill_id,level_value")
        .eq("user_id", auth.user.id)
    ]);
  if (rolesError) throw rolesError;
  if (skillsError) throw skillsError;

  // One most recent active version per role; older versions remain in history.
  const mostRecent = new Map<string, NonNullable<typeof versions>[number]>();
  for (const version of versions ?? []) {
    const roleId = String(version.role_id);
    if (!mostRecent.has(roleId)) mostRecent.set(roleId, version);
  }
  const currentVersions = [...mostRecent.values()];
  const versionIds = currentVersions.map(version => String(version.id));

  let requirements: Array<{
    role_version_id: string;
    skill_id: string;
    group_id: string;
    requirement_groups: RequirementGroup | RequirementGroup[] | null;
    target_score: number;
    importance: number;
    importance_band: string;
    learning_stage: number;
    rationale: string;
    skills: RequirementSkill | RequirementSkill[] | null;
  }> = [];
  if (versionIds.length) {
    const { data, error } = await supabase
      .from("role_skill_requirements")
      .select("role_version_id,skill_id,group_id,target_score,importance,importance_band,learning_stage,rationale,skills!inner(canonical_name,category),requirement_groups!inner(name,group_type)")
      .in("role_version_id", versionIds)
      .limit(2500);
    if (error) throw error;
    requirements = (data ?? []) as typeof requirements;
  }

  const documentedSkillIds = new Set(
    (knownSkills ?? []).filter(item => item.level_value !== "UNKNOWN")
      .map(item => String(item.skill_id))
  );

  const roles: DiscoverableRole[] = currentVersions.map(version => {
    const meta = one(version.target_roles as RoleMeta | RoleMeta[] | null);
    const reqs = requirements
      .filter(item => item.role_version_id === version.id)
      .sort((a, b) => Number(b.importance) - Number(a.importance));

    const uniqueIds = new Set(reqs.map(item => item.skill_id));
    const demonstratedCount = [...uniqueIds].filter(id => documentedSkillIds.has(id)).length;

    const source: DiscoverableRole["source"] = version.source === "AI_GENERATED" ? "AI_GENERATED" : "SEEDED";
    return {
      id: String(version.id),
      roleId: String(version.role_id),
      name: String(meta?.name ?? "Career role"),
      family: String(meta?.family ?? "Other careers"),
      version: Number(version.version),
      source,
      personal: Boolean(meta?.owner_user_id),
      requirementCount: uniqueIds.size,
      documentedCount: demonstratedCount,
      requirements: reqs.map(item => {
        const skill = one(item.skills);
        const group = one(item.requirement_groups);
        const groupType: DiscoverableRole["requirements"][number]["groupType"] =
          group?.group_type === "ANY_OF" ? "ANY_OF" : group?.group_type === "ALL_OF" ? "ALL_OF" : "SINGLE";
        return {
          groupName: group?.name ?? "Competency",
          groupType,
          skillId: item.skill_id,
          name: skill?.canonical_name ?? "Competency",
          category: skill?.category ?? "",
          importance: String(item.importance_band),
          stage: Number(item.learning_stage),
          targetScore: Number(item.target_score),
          rationale: String(item.rationale)
        };
      })
    };
  }).sort((a, b) => a.family.localeCompare(b.family) || a.name.localeCompare(b.name));

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
      <CareerDiscovery roles={roles} />
    </main>
  );
}
