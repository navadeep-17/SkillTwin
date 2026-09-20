import "server-only";
import { getSql } from "@/lib/db/postgres";
import type { GapAnalysis } from "@/lib/domain/gap-engine";
import type { RoleVersion } from "@/lib/domain/role-model";
import type { ConfidenceBand, SkillLevel, UserSkillState } from "@/lib/domain/skills";

const confidenceBand = (value: number): ConfidenceBand => value < 0.45 ? "LOW" : value < 0.75 ? "MEDIUM" : "HIGH";

export interface CareerGoal {
  id: string;
  roleVersionId: string;
  targetDate: string | null;
  hoursPerWeek: number;
  adaptationMode: "AUTOMATIC" | "ASK_FIRST";
  preferredAlternatives: Record<string, string>;
}

export class PostgresGapRepository {
  async getOrCreateDefaultGoal(userId: string): Promise<CareerGoal> {
    const sql = getSql();
    let rows = await sql<Record<string, unknown>[]>`
      select * from public.career_goals where user_id=${userId}::uuid and status='ACTIVE' limit 1
    `;
    if (!rows[0]) {
      rows = await sql<Record<string, unknown>[]>`
        insert into public.career_goals(user_id, role_version_id)
        values (${userId}::uuid, ${BACKEND_ROLE_VERSION_ID}::uuid)
        returning *
      `;
    }
    const row = rows[0];
    return {
      id: String(row.id),
      roleVersionId: String(row.role_version_id),
      targetDate: row.target_date ? String(row.target_date) : null,
      hoursPerWeek: Number(row.hours_per_week),
      adaptationMode: String(row.adaptation_mode) as CareerGoal["adaptationMode"],
      preferredAlternatives: row.preferred_alternatives && typeof row.preferred_alternatives === "object"
        ? row.preferred_alternatives as Record<string, string>
        : {}
    };
  }

  async loadRoleVersion(roleVersionId: string): Promise<RoleVersion> {
    const sql = getSql();
    const versions = await sql<Record<string, unknown>[]>`
      select rv.id,rv.version,tr.id role_id,tr.name
      from public.role_versions rv
      join public.target_roles tr on tr.id=rv.role_id
      where rv.id=${roleVersionId}::uuid and rv.status='ACTIVE'
      limit 1
    `;
    if (!versions[0]) throw new Error("ACTIVE_ROLE_VERSION_NOT_FOUND");

    const [groups, requirements, dependencies] = await Promise.all([
      sql<Record<string, unknown>[]>`
        select id,name,group_type,group_importance
        from public.requirement_groups where role_version_id=${roleVersionId}::uuid order by id
      `,
      sql<Record<string, unknown>[]>`
        select id,group_id,skill_id,target_score,importance,learning_stage,is_default_alternative,rationale
        from public.role_skill_requirements where role_version_id=${roleVersionId}::uuid order by id
      `,
      sql<Record<string, unknown>[]>`
        select prerequisite_requirement_id,dependent_requirement_id,edge_type
        from public.role_dependency_edges where role_version_id=${roleVersionId}::uuid order by id
      `
    ]);
    const version = versions[0];
    return {
      roleId: String(version.role_id),
      roleName: String(version.name),
      roleVersionId: String(version.id),
      version: Number(version.version),
      groups: groups.map(row => ({ id:String(row.id), name:String(row.name), type:String(row.group_type) as "SINGLE"|"ALL_OF"|"ANY_OF", groupImportance:Number(row.group_importance) })),
      requirements: requirements.map(row => ({
        id:String(row.id), groupId:String(row.group_id), skillId:String(row.skill_id),
        targetScore:Number(row.target_score), importance:Number(row.importance),
        learningStage:Number(row.learning_stage) as 1|2|3|4,
        isDefaultAlternative:Boolean(row.is_default_alternative), rationale:String(row.rationale)
      })),
      dependencies: dependencies.map(row => ({
        prerequisiteRequirementId:String(row.prerequisite_requirement_id),
        dependentRequirementId:String(row.dependent_requirement_id),
        edgeType:String(row.edge_type) as "HARD"|"SOFT"
      }))
    };
  }

  async listUserSkills(userId: string): Promise<UserSkillState[]> {
    const sql = getSql();
    const rows = await sql<Record<string, unknown>[]>`
      select * from public.user_skills where user_id=${userId}::uuid
    `;
    return rows.map(row => {
      const confidence = Number(row.confidence ?? 0.1);
      return {
        skillId:String(row.skill_id),
        capabilityScore:row.capability_score == null ? null : Number(row.capability_score),
        level:String(row.level_value) as SkillLevel,
        confidence,
        confidenceBand:confidenceBand(confidence),
        conflictState:String(row.conflict_state) as UserSkillState["conflictState"],
        evidenceCount:Number(row.evidence_count),
        sourceFamilyCount:Number(row.source_family_count),
        lastValidatedAt:row.last_validated_at ? new Date(String(row.last_validated_at)).toISOString() : null,
        estimatorVersion:String(row.estimator_version)
      };
    });
  }

  async persistSnapshot(userId: string, goal: CareerGoal, analysis: GapAnalysis, trigger: {type:string;ref:string}, roleName = "target role") {
    const sql = getSql();
    return sql.begin(async tx => {
      const snapshots = await tx<{id:string}[]>`
        insert into public.gap_snapshots(
          user_id,goal_id,role_version_id,readiness,evidence_coverage,selected_alternatives,trigger_type,trigger_ref,as_of
        ) values (
          ${userId}::uuid,${goal.id}::uuid,${goal.roleVersionId}::uuid,${analysis.readiness},${analysis.evidenceCoverage},
          ${JSON.stringify(analysis.selectedAlternatives)}::jsonb,${trigger.type},${trigger.ref},now()
        ) returning id
      `;
      const snapshotId = snapshots[0].id;
      for (const gap of analysis.gaps) {
        await tx`
          insert into public.skill_gap_results(
            snapshot_id,user_id,requirement_id,group_id,skill_id,current_score,current_confidence,target_score,
            attainment,gap_severity,dependency_impact,urgency,priority_score,priority_band,status,recommended_action,reason_codes
          ) values (
            ${snapshotId}::uuid,${userId}::uuid,${gap.requirementId}::uuid,${gap.groupId}::uuid,${gap.skillId}::uuid,
            ${gap.currentScore},${gap.currentConfidence},${gap.targetScore},${gap.attainment},${gap.gapSeverity},
            ${gap.dependencyImpact},${gap.urgency},${gap.priorityScore},${gap.priorityBand},${gap.status},
            ${gap.recommendedAction},${JSON.stringify(gap.reasonCodes)}::jsonb
          )
        `;
      }
      await tx`
        insert into public.agent_events(user_id,event_type,trigger_type,trigger_ref,summary,entity_refs,metadata)
        values (
          ${userId}::uuid,'gap.analysis.completed',${trigger.type},${trigger.ref},
          ${`Career readiness recalculated to ${analysis.readiness}% for ${roleName}.`},
          ${JSON.stringify([{type:"gap_snapshot",id:snapshotId},{type:"career_goal",id:goal.id}])}::jsonb,
          ${JSON.stringify({readiness:analysis.readiness,evidenceCoverage:analysis.evidenceCoverage})}::jsonb
        )
      `;
      return snapshotId;
    });
  }

  async latest(userId: string) {
    const sql = getSql();
    const rows = await sql<Record<string, unknown>[]>`
      select * from public.gap_snapshots where user_id=${userId}::uuid order by created_at desc limit 1
    `;
    if (!rows[0]) return null;
    const row = rows[0];
    const gaps = await sql<Record<string, unknown>[]>`
      select sgr.*,s.canonical_name,s.slug
      from public.skill_gap_results sgr
      join public.skills s on s.id=sgr.skill_id
      where snapshot_id=${String(row.id)}::uuid
      order by priority_score desc,s.canonical_name
    `;
    return {
      snapshotId:String(row.id),
      readiness:Number(row.readiness),
      evidenceCoverage:Number(row.evidence_coverage),
      selectedAlternatives:row.selected_alternatives as Record<string,string>,
      gaps
    };
  }
}
