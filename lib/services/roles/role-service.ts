import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getSql } from "@/lib/db/postgres";
import { getGeminiStructuredClient } from "@/lib/ai/gemini-interactions";

const groupTypeSchema = z.enum(["SINGLE","ALL_OF","ANY_OF"]);
const importanceBandSchema = z.enum(["CORE","IMPORTANT","SUPPORTING"]);
const levelContextSchema = z.enum(["ENTRY","MID","ADVANCED"]);
const targetBandSchema = z.enum([
  "AWARENESS",
  "BEGINNER",
  "STRONG_BEGINNER",
  "INTERMEDIATE",
  "STRONG_INTERMEDIATE",
  "ADVANCED"
]);

const candidateSchema = z.object({
  roleName: z.string().trim().min(2).max(120),
  levelContext: levelContextSchema,
  groups: z.array(z.object({
    name: z.string().trim().min(2).max(100),
    type: groupTypeSchema,
    importanceBand: importanceBandSchema
  })).min(3).max(12),
  requirements: z.array(z.object({
    groupRef: z.string().trim().min(1).max(100),
    skillName: z.string().trim().min(1).max(100),
    targetBand: targetBandSchema,
    importanceBand: importanceBandSchema,
    stage: z.number().int().min(1).max(4),
    rationale: z.string().trim().min(3).max(300)
  })).min(6).max(30),
  prerequisites: z.array(z.object({
    fromSkillName: z.string().trim().min(1).max(100),
    toSkillName: z.string().trim().min(1).max(100),
    strength: z.enum(["HARD","SOFT"]),
    rationale: z.string().trim().min(3).max(240)
  })).max(40),
  unresolvedConcepts: z.array(z.string().trim().min(1).max(100)).max(20)
});

type GeneratedRoleCandidate = z.infer<typeof candidateSchema>;
type Row = Record<string, unknown>;
const rows = (value: unknown) => value as Row[];

const responseJsonSchema: Record<string, unknown> = {
  type:"object",
  properties:{
    roleName:{type:"string"},
    levelContext:{type:"string",enum:["ENTRY","MID","ADVANCED"]},
    groups:{
      type:"array",
      items:{
        type:"object",
        properties:{
          name:{type:"string"},
          type:{type:"string",enum:["SINGLE","ALL_OF","ANY_OF"]},
          importanceBand:{type:"string",enum:["CORE","IMPORTANT","SUPPORTING"]}
        },
        required:["name","type","importanceBand"]
      }
    },
    requirements:{
      type:"array",
      items:{
        type:"object",
        properties:{
          groupRef:{type:"string"},
          skillName:{type:"string"},
          targetBand:{type:"string",enum:["AWARENESS","BEGINNER","STRONG_BEGINNER","INTERMEDIATE","STRONG_INTERMEDIATE","ADVANCED"]},
          importanceBand:{type:"string",enum:["CORE","IMPORTANT","SUPPORTING"]},
          stage:{type:"integer"},
          rationale:{type:"string"}
        },
        required:["groupRef","skillName","targetBand","importanceBand","stage","rationale"]
      }
    },
    prerequisites:{
      type:"array",
      items:{
        type:"object",
        properties:{
          fromSkillName:{type:"string"},
          toSkillName:{type:"string"},
          strength:{type:"string",enum:["HARD","SOFT"]},
          rationale:{type:"string"}
        },
        required:["fromSkillName","toSkillName","strength","rationale"]
      }
    },
    unresolvedConcepts:{type:"array",items:{type:"string"}}
  },
  required:["roleName","levelContext","groups","requirements","prerequisites","unresolvedConcepts"]
};

const importanceValue = (band: z.infer<typeof importanceBandSchema>) =>
  band === "CORE" ? 1 : band === "IMPORTANT" ? 0.75 : 0.45;

const targetScore = (band: z.infer<typeof targetBandSchema>) => ({
  AWARENESS:0.5,
  BEGINNER:1.0,
  STRONG_BEGINNER:1.5,
  INTERMEDIATE:2.0,
  STRONG_INTERMEDIATE:2.5,
  ADVANCED:3.0
}[band]);

function slugify(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,80);
}

function normalize(value: string) {
  return value.toLowerCase().normalize("NFKC").replace(/[^a-z0-9+#.]+/g," ").replace(/\s+/g," ").trim();
}

export interface RoleValidationReport {
  valid: boolean;
  errors: Array<{code:string;message:string}>;
  warnings: Array<{code:string;message:string}>;
  droppedUnresolvedRequirements: string[];
  normalizedValues: Record<string, unknown>;
}

export class RoleService {
  async list(userId:string) {
    const sql = getSql();
    return rows(await sql.unsafe(
      "select tr.id,tr.slug,tr.name,tr.family,rv.id role_version_id,rv.version,rv.source,rv.schema_version from public.target_roles tr join lateral (select * from public.role_versions x where x.role_id=tr.id and x.status='ACTIVE' order by x.version desc limit 1) rv on true where tr.owner_user_id is null or tr.owner_user_id=$1::uuid order by tr.family nulls last,tr.name",
      [userId]
    )).map(row => ({
      id:String(row.id),
      slug:String(row.slug),
      name:String(row.name),
      family:row.family == null ? null : String(row.family),
      roleVersionId:String(row.role_version_id),
      version:Number(row.version),
      source:String(row.source),
      schemaVersion:String(row.schema_version)
    }));
  }

  async get(userId:string, roleIdOrVersionId: string) {
    const sql = getSql();
    const versionRows = rows(await sql.unsafe(
      "select rv.id,rv.version,rv.source,rv.status,rv.schema_version,tr.id role_id,tr.slug,tr.name,tr.family from public.role_versions rv join public.target_roles tr on tr.id=rv.role_id where (rv.id=$1::uuid or tr.id=$1::uuid) and (tr.owner_user_id is null or tr.owner_user_id=$2::uuid) order by rv.version desc limit 1",
      [roleIdOrVersionId,userId]
    ));
    if (!versionRows[0]) throw new Error("ROLE_NOT_FOUND");
    const version = versionRows[0];
    const versionId = String(version.id);

    const [groups,requirements,dependencies] = await Promise.all([
      sql.unsafe(
        "select id,name,group_type,group_importance from public.requirement_groups where role_version_id=$1::uuid order by group_importance desc,name",
        [versionId]
      ),
      sql.unsafe(
        "select rsr.id,rsr.group_id,rsr.skill_id,rsr.target_score,rsr.importance,rsr.importance_band,rsr.learning_stage,rsr.is_default_alternative,rsr.rationale,s.slug,s.canonical_name,s.category from public.role_skill_requirements rsr join public.skills s on s.id=rsr.skill_id where rsr.role_version_id=$1::uuid order by rsr.learning_stage,rsr.importance desc,s.canonical_name",
        [versionId]
      ),
      sql.unsafe(
        "select prerequisite_requirement_id,dependent_requirement_id,edge_type from public.role_dependency_edges where role_version_id=$1::uuid order by id",
        [versionId]
      )
    ]);

    return {
      id:String(version.role_id),
      slug:String(version.slug),
      name:String(version.name),
      family:version.family == null ? null : String(version.family),
      roleVersionId:versionId,
      version:Number(version.version),
      source:String(version.source),
      status:String(version.status),
      schemaVersion:String(version.schema_version),
      groups:rows(groups).map(row=>({
        id:String(row.id),name:String(row.name),type:String(row.group_type),groupImportance:Number(row.group_importance)
      })),
      requirements:rows(requirements).map(row=>({
        id:String(row.id),
        groupId:String(row.group_id),
        skillId:String(row.skill_id),
        skillSlug:String(row.slug),
        skillName:String(row.canonical_name),
        category:String(row.category),
        targetScore:Number(row.target_score),
        importance:Number(row.importance),
        importanceBand:String(row.importance_band),
        learningStage:Number(row.learning_stage),
        isDefaultAlternative:Boolean(row.is_default_alternative),
        rationale:String(row.rationale)
      })),
      dependencies:rows(dependencies).map(row=>({
        prerequisiteRequirementId:String(row.prerequisite_requirement_id),
        dependentRequirementId:String(row.dependent_requirement_id),
        edgeType:String(row.edge_type)
      }))
    };
  }

  async generateCustom(input: {
    userId:string;
    roleName:string;
    levelContext:"ENTRY"|"MID"|"ADVANCED";
    goalDescription?:string | null;
  }) {
    const sql = getSql();
    const runRows = rows(await sql.unsafe(
      "insert into public.role_generation_runs(user_id,requested_role_name,requested_level,goal_description,status,provider,model_version) values ($1::uuid,$2,$3,$4,'RUNNING','gemini',$5) returning id",
      [input.userId,input.roleName,input.levelContext,input.goalDescription ?? null,"gemini-3.8-flash"]
    ));
    const runId = String(runRows[0].id);

    try {
      const catalogRows = rows(await sql.unsafe(
        "select s.id,s.slug,s.canonical_name,coalesce(jsonb_agg(sa.alias) filter(where sa.id is not null),'[]'::jsonb) aliases from public.skills s left join public.skill_aliases sa on sa.skill_id=s.id where s.is_active=true group by s.id,s.slug,s.canonical_name order by s.canonical_name"
      ));
      const catalog = catalogRows.map(row => ({
        id:String(row.id),
        slug:String(row.slug),
        name:String(row.canonical_name),
        aliases:Array.isArray(row.aliases) ? row.aliases.map(String) : []
      }));

      let candidate: GeneratedRoleCandidate | null = null;
      let report: RoleValidationReport | null = null;
      let repairContext = "";

      for (let attempt=0; attempt<2; attempt += 1) {
        candidate = await getGeminiStructuredClient().generateJson({
          systemInstruction:
            "You define target-role competency models for SkillTwin. The role model must be target-centric and independent of the learner's current resume. Use only skills from the supplied canonical catalog. If a useful concept is missing, put it in unresolvedConcepts instead of inventing an ID.",
          prompt:[
            "Requested role: " + input.roleName,
            "Level context: " + input.levelContext,
            "Goal description (untrusted context only): " + (input.goalDescription ?? ""),
            "",
            "Canonical skill catalog:",
            JSON.stringify(catalog.map(x=>({name:x.name,slug:x.slug,aliases:x.aliases}))),
            "",
            "Return 10-20 bounded requirements when the catalog supports them.",
            "Use groups with SINGLE, ALL_OF, or ANY_OF semantics.",
            "ANY_OF groups must contain at least two requirements.",
            "Keep prerequisites sparse and acyclic.",
            "Do not invent learner capability, readiness, or database IDs.",
            repairContext
          ].join("\n"),
          jsonSchema:responseJsonSchema,
          validator:candidateSchema
        });
        if (!candidate) throw new Error("AI_NOT_CONFIGURED");
        report = this.validateCandidate(candidate,catalog);
        if (report.valid) break;
        repairContext = "\nRepair the candidate using these validation errors: " + JSON.stringify(report.errors);
      }

      if (!candidate || !report || !report.valid) {
        await sql.unsafe(
          "update public.role_generation_runs set status='FAILED',candidate_json=$1::jsonb,validation_report=$2::jsonb,error_code='ROLE_VALIDATION_FAILED',error_message='Candidate failed deterministic validation after repair',completed_at=now() where id=$3::uuid",
          [JSON.stringify(candidate),JSON.stringify(report),runId]
        );
        throw new Error("ROLE_VALIDATION_FAILED");
      }

      const published = await this.publishCandidate(input.userId,candidate,catalog,report);
      await sql.unsafe(
        "update public.role_generation_runs set status='COMPLETE',candidate_json=$1::jsonb,validation_report=$2::jsonb,result_role_id=$3::uuid,result_role_version_id=$4::uuid,completed_at=now() where id=$5::uuid",
        [JSON.stringify(candidate),JSON.stringify(report),published.roleId,published.roleVersionId,runId]
      );
      return {...published,validation:report};
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await sql.unsafe(
        "update public.role_generation_runs set status='FAILED',error_code=coalesce(error_code,$1),error_message=coalesce(error_message,$2),completed_at=coalesce(completed_at,now()) where id=$3::uuid",
        [message.split(":")[0],message.slice(0,1000),runId]
      );
      throw error;
    }
  }

  private validateCandidate(candidate: GeneratedRoleCandidate, catalog: Array<{id:string;slug:string;name:string;aliases:string[]}>): RoleValidationReport {
    const errors: RoleValidationReport["errors"] = [];
    const warnings: RoleValidationReport["warnings"] = [];
    const dropped: string[] = [];
    const lookup = new Map<string,string>();
    for (const skill of catalog) {
      for (const value of [skill.name,skill.slug,...skill.aliases]) lookup.set(normalize(value),skill.id);
    }

    const groupNames = new Set(candidate.groups.map(group=>group.name));
    const mapped = candidate.requirements.map(req => ({
      ...req,
      skillId:lookup.get(normalize(req.skillName)) ?? null
    }));

    for (const req of mapped) {
      if (!groupNames.has(req.groupRef)) errors.push({code:"UNKNOWN_GROUP",message:req.skillName+" references missing group "+req.groupRef});
      if (!req.skillId) dropped.push(req.skillName);
    }

    const publishable = mapped.filter(req=>req.skillId);
    if (publishable.length < 6 || publishable.length > 30) errors.push({code:"REQUIREMENT_COUNT",message:"Published role must contain 6-30 canonical requirements."});

    for (const group of candidate.groups) {
      const members = publishable.filter(req=>req.groupRef===group.name);
      if (group.type==="ANY_OF" && members.length<2) errors.push({code:"ANY_OF_TOO_SMALL",message:"ANY_OF group "+group.name+" needs at least two canonical alternatives."});
    }

    const duplicateMandatory = new Map<string,number>();
    for (const req of publishable) {
      const group = candidate.groups.find(g=>g.name===req.groupRef);
      if (group?.type !== "ANY_OF") duplicateMandatory.set(req.skillId!, (duplicateMandatory.get(req.skillId!) ?? 0)+1);
    }
    for (const [skillId,count] of duplicateMandatory) if (count>1) errors.push({code:"DUPLICATE_MANDATORY_SKILL",message:"Canonical skill "+skillId+" appears repeatedly as mandatory."});

    const reqByName = new Map(publishable.map(req=>[normalize(req.skillName),req]));
    const edges = candidate.prerequisites
      .map(edge=>({
        from:reqByName.get(normalize(edge.fromSkillName)),
        to:reqByName.get(normalize(edge.toSkillName))
      }))
      .filter(edge=>edge.from?.skillId && edge.to?.skillId && edge.from.skillId!==edge.to.skillId);

    const adjacency = new Map<string,string[]>();
    for (const edge of edges) {
      const list = adjacency.get(edge.from!.skillId!) ?? [];
      list.push(edge.to!.skillId!);
      adjacency.set(edge.from!.skillId!,list);
    }
    const visiting = new Set<string>(), visited = new Set<string>();
    const hasCycle = (id:string):boolean => {
      if (visiting.has(id)) return true;
      if (visited.has(id)) return false;
      visiting.add(id);
      for (const next of adjacency.get(id) ?? []) if (hasCycle(next)) return true;
      visiting.delete(id); visited.add(id); return false;
    };
    for (const id of adjacency.keys()) if (hasCycle(id)) { errors.push({code:"CYCLIC_GRAPH",message:"Prerequisite graph contains a cycle."}); break; }

    if (dropped.length) warnings.push({code:"UNRESOLVED_SKILLS_DROPPED",message:"Dropped unresolved concepts: "+dropped.join(", ")});

    return {
      valid:errors.length===0,
      errors,
      warnings,
      droppedUnresolvedRequirements:[...new Set([...dropped,...candidate.unresolvedConcepts])],
      normalizedValues:{
        requirements:publishable.map(req=>({
          ...req,
          importance:importanceValue(req.importanceBand),
          targetScore:targetScore(req.targetBand)
        }))
      }
    };
  }

  private async publishCandidate(
    userId:string,
    candidate:GeneratedRoleCandidate,
    catalog:Array<{id:string;slug:string;name:string;aliases:string[]}>,
    report:RoleValidationReport
  ) {
    const sql = getSql();
    const lookup = new Map<string,string>();
    for (const skill of catalog) for (const value of [skill.name,skill.slug,...skill.aliases]) lookup.set(normalize(value),skill.id);

    return sql.begin(async tx => {
      const baseSlug = slugify(candidate.roleName) || "custom-role";
      const slug = baseSlug+"-"+randomUUID().slice(0,8);
      const roleId = randomUUID();
      const roleVersionId = randomUUID();
      await tx.unsafe(
        "insert into public.target_roles(id,slug,name,family,owner_user_id) values ($1::uuid,$2,$3,'Custom',$4::uuid)",
        [roleId,slug,candidate.roleName,userId]
      );
      await tx.unsafe(
        "insert into public.role_versions(id,role_id,version,source,status,schema_version) values ($1::uuid,$2::uuid,1,'AI_GENERATED','ACTIVE','role-c1')",
        [roleVersionId,roleId]
      );

      const groupIds = new Map<string,string>();
      for (const group of candidate.groups) {
        const groupId = randomUUID();
        groupIds.set(group.name,groupId);
        await tx.unsafe(
          "insert into public.requirement_groups(id,role_version_id,name,group_type,group_importance) values ($1::uuid,$2::uuid,$3,$4,$5)",
          [groupId,roleVersionId,group.name,group.type,importanceValue(group.importanceBand)]
        );
      }

      const requirementBySkillName = new Map<string,string>();
      for (const req of candidate.requirements) {
        const skillId = lookup.get(normalize(req.skillName));
        const groupId = groupIds.get(req.groupRef);
        if (!skillId || !groupId) continue;
        const reqId = randomUUID();
        requirementBySkillName.set(normalize(req.skillName),reqId);
        const group = candidate.groups.find(g=>g.name===req.groupRef)!;
        const groupMembers = candidate.requirements.filter(x=>x.groupRef===req.groupRef && lookup.get(normalize(x.skillName)));
        const isDefault = group.type!=="ANY_OF" || groupMembers[0]?.skillName===req.skillName;
        await tx.unsafe(
          "insert into public.role_skill_requirements(id,role_version_id,group_id,skill_id,target_score,importance,importance_band,learning_stage,is_default_alternative,rationale) values ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8,$9,$10)",
          [reqId,roleVersionId,groupId,skillId,targetScore(req.targetBand),importanceValue(req.importanceBand),req.importanceBand,req.stage,isDefault,req.rationale]
        );
      }

      for (const edge of candidate.prerequisites) {
        const from = requirementBySkillName.get(normalize(edge.fromSkillName));
        const to = requirementBySkillName.get(normalize(edge.toSkillName));
        if (!from || !to || from===to) continue;
        await tx.unsafe(
          "insert into public.role_dependency_edges(role_version_id,prerequisite_requirement_id,dependent_requirement_id,edge_type) values ($1::uuid,$2::uuid,$3::uuid,$4) on conflict do nothing",
          [roleVersionId,from,to,edge.strength]
        );
      }

      await tx.unsafe(
        "insert into public.agent_events(user_id,event_type,trigger_type,trigger_ref,summary,entity_refs,metadata) values ($1::uuid,'role.custom.created','CUSTOM_ROLE',$2,$3,$4::jsonb,$5::jsonb)",
        [
          userId,roleVersionId,
          "Created validated custom target-role model: "+candidate.roleName+".",
          JSON.stringify([{type:"target_role",id:roleId},{type:"role_version",id:roleVersionId}]),
          JSON.stringify({levelContext:candidate.levelContext,validation:report})
        ]
      );
      return {roleId,roleVersionId,name:candidate.roleName,slug};
    });
  }
}

let service:RoleService|null=null;
export function getRoleService() {
  if (!service) service=new RoleService();
  return service;
}
