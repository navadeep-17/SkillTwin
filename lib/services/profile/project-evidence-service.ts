import "server-only";
import { getSql } from "@/lib/db/postgres";
import type { EvidenceCandidate } from "@/lib/domain/skills";
import { getEvidenceEngine } from "@/lib/services/skills/evidence-service";
import { getGapAnalysisService } from "@/lib/services/gaps/gap-analysis-service";
import { PostgresProfileAnalysisRepository } from "@/lib/repositories/postgres/profile-analysis-repository";

export const PROJECT_ANALYZER_VERSION = "project-analyzer-b2";

type Row=Record<string,unknown>;
const rows=(value:unknown)=>value as Row[];

const USAGE_VERBS=["built","implemented","developed","created","integrated","used","using","designed","deployed","optimized","architected","tested","secured","maintained"];
const STRONG_VERBS=["designed","deployed","optimized","architected","scaled","migrated"];

function escapeRegex(value:string){return value.replace(/[|\\{}()[\]^$+*?.-]/g,"\\$&");}
function normalize(value:string){return value.normalize("NFKC").toLowerCase().replace(/\s+/g," ").trim();}
function lineContaining(text:string,alias:string){
  const lower=text.toLowerCase(),index=lower.indexOf(alias.toLowerCase());
  if(index<0)return text.slice(0,420).trim();
  const lineStart=text.lastIndexOf("\n",index),lineEnd=text.indexOf("\n",index);
  return text.slice(lineStart<0?0:lineStart+1,lineEnd<0?text.length:lineEnd).trim().slice(0,420);
}
function usageSignal(snippet:string){
  const text=normalize(snippet);
  if(!USAGE_VERBS.some(verb=>text.includes(verb))) return null;
  return STRONG_VERBS.some(verb=>text.includes(verb))?2.05:1.65;
}

export class ProjectEvidenceService {
  private readonly profileRepository=new PostgresProfileAnalysisRepository();

  async createAndAnalyze(input:{userId:string;title:string;description:string;technologies:string[];artifactUrl?:string|null}) {
    const sql=getSql();
    const project=rows(await sql.unsafe(
      "insert into public.profile_projects(user_id,title,description,technologies,artifact_url,analysis_status) values ($1::uuid,$2,$3,$4::jsonb,$5,'RUNNING') returning *",
      [input.userId,input.title,input.description,JSON.stringify(input.technologies),input.artifactUrl ?? null]
    ))[0];
    return this.analyzeRecord(input.userId,project,[]);
  }

  async updateAndAnalyze(input:{userId:string;projectId:string;title?:string;description?:string;technologies?:string[];artifactUrl?:string|null}) {
    const sql=getSql();
    const current=rows(await sql.unsafe(
      "select * from public.profile_projects where id=$1::uuid and user_id=$2::uuid and status='ACTIVE' limit 1",
      [input.projectId,input.userId]
    ))[0];
    if(!current) throw new Error("PROJECT_NOT_FOUND");

    const previousGroup="project:"+input.projectId+":v"+String(current.version);
    const oldEvidence=rows(await sql.unsafe(
      "select id,skill_id from public.skill_evidence where user_id=$1::uuid and source_group_id=$2 and status in ('ACCEPTED','NON_AGGREGATING')",
      [input.userId,previousGroup]
    ));
    const affectedSkillIds=[...new Set(oldEvidence.map(row=>String(row.skill_id)))];

    if(oldEvidence.length){
      await sql.unsafe(
        "update public.skill_evidence set status='SUPERSEDED' where user_id=$1::uuid and source_group_id=$2 and status in ('ACCEPTED','NON_AGGREGATING')",
        [input.userId,previousGroup]
      );
    }

    const next=rows(await sql.unsafe(
      "update public.profile_projects set title=$1,description=$2,technologies=$3::jsonb,artifact_url=$4,version=version+1,analysis_status='RUNNING',analysis_result=null where id=$5::uuid and user_id=$6::uuid returning *",
      [
        input.title ?? String(current.title),
        input.description ?? String(current.description),
        JSON.stringify(input.technologies ?? (Array.isArray(current.technologies)?current.technologies:[])),
        Object.prototype.hasOwnProperty.call(input,"artifactUrl") ? input.artifactUrl ?? null : current.artifact_url ?? null,
        input.projectId,input.userId
      ]
    ))[0];

    return this.analyzeRecord(input.userId,next,affectedSkillIds);
  }

  private async analyzeRecord(userId:string,project:Row,previouslyAffectedSkillIds:string[]) {
    const sql=getSql();
    const projectId=String(project.id);
    try{
      const catalog=await this.profileRepository.listCatalog();
      const candidates:EvidenceCandidate[]=[];
      const seen=new Set<string>();
      const description=String(project.description),technologies=Array.isArray(project.technologies)?project.technologies.map(String):[];
      const techText=technologies.join(" ");
      const aliases=catalog.flatMap(skill=>[...new Set([skill.canonicalName,skill.slug,...skill.aliases].filter(Boolean))].map(alias=>({skill,alias}))).sort((a,b)=>b.alias.length-a.alias.length);

      for(const {skill,alias} of aliases){
        if(seen.has(skill.id))continue;
        const pattern=new RegExp("(^|[^a-zA-Z0-9])"+escapeRegex(alias)+"(?=$|[^a-zA-Z0-9])","i");
        const inDescription=pattern.test(description),inTechnologyList=pattern.test(techText);
        if(!inDescription&&!inTechnologyList)continue;
        seen.add(skill.id);
        const snippet=inDescription?lineContaining(description,alias):"Declared project technology: "+alias;
        const levelSignal=inDescription?usageSignal(snippet):null;
        const usage=levelSignal!=null;
        candidates.push({
          skillId:skill.id,sourceType:"PROJECT_DESCRIPTION",sourceRef:projectId,
          sourceGroupId:"project:"+projectId+":v"+String(project.version),
          claim:snippet,levelSignal,directness:usage?1:0.82,quality:usage?0.72:0.48,coverage:usage?0.58:0.28,
          metadata:{projectId,projectTitle:String(project.title),projectVersion:Number(project.version),artifactUrl:project.artifact_url ?? null,matchedAlias:alias,matchSource:inDescription?"description":"technology_list",analyzerVersion:PROJECT_ANALYZER_VERSION},
          idempotencyKey:"project:"+projectId+":v"+String(project.version)+":"+skill.id
        });
      }

      const evidenceResult=await getEvidenceEngine().ingestBatch({
        userId,trigger:{type:"PROJECT_ANALYSIS",ref:projectId},candidates,producerVersion:PROJECT_ANALYZER_VERSION
      });
      const recomputed=previouslyAffectedSkillIds.length
        ? await getEvidenceEngine().recomputeSkills({userId,skillIds:previouslyAffectedSkillIds,trigger:{type:"PROJECT_REANALYSIS",ref:projectId}})
        : {deltas:[],downstream:{runGapAnalysis:false,considerReplan:false}};
      const allDeltas=[...evidenceResult.deltas,...recomputed.deltas];
      const shouldGap=evidenceResult.downstream.runGapAnalysis || recomputed.downstream.runGapAnalysis;
      const gapResult=shouldGap
        ? await getGapAnalysisService().recompute(userId,{type:"PROJECT_SKILL_DELTA",ref:projectId})
        : null;

      const result={
        projectId,version:Number(project.version),matchedSkills:candidates.length,
        evidence:{...evidenceResult,deltas:allDeltas,downstream:{
          runGapAnalysis:shouldGap,
          considerReplan:evidenceResult.downstream.considerReplan||recomputed.downstream.considerReplan
        }},
        gapAnalysis:gapResult?{snapshotId:gapResult.snapshotId,readiness:gapResult.readiness,evidenceCoverage:gapResult.evidenceCoverage}:null
      };
      await sql.begin(async tx=>{
        await tx.unsafe("update public.profile_projects set analysis_status='COMPLETE',analysis_result=$1::jsonb where id=$2::uuid and user_id=$3::uuid",[JSON.stringify(result),projectId,userId]);
        await tx.unsafe(
          "insert into public.agent_events(user_id,event_type,trigger_type,trigger_ref,summary,entity_refs,evidence_refs,metadata) values ($1::uuid,'project.evidence.processed','PROJECT_ANALYSIS',$2,$3,$4::jsonb,$5::jsonb,$6::jsonb)",
          [userId,projectId,"Processed project evidence from "+String(project.title)+" v"+String(project.version)+" across "+candidates.length+" canonical skills.",JSON.stringify([{type:"profile_project",id:projectId}]),JSON.stringify(evidenceResult.acceptedEvidenceIds),JSON.stringify({matchedSkills:candidates.length,skillDeltas:allDeltas.length,analyzerVersion:PROJECT_ANALYZER_VERSION,previousEvidenceSuperseded:previouslyAffectedSkillIds.length>0})]
        );
      });
      return result;
    }catch(error){
      await sql.unsafe(
        "update public.profile_projects set analysis_status='FAILED',analysis_result=$1::jsonb where id=$2::uuid and user_id=$3::uuid",
        [JSON.stringify({error:error instanceof Error?error.message.slice(0,600):String(error).slice(0,600)}),projectId,userId]
      );
      throw error;
    }
  }
}

let service:ProjectEvidenceService|null=null;
export function getProjectEvidenceService(){if(!service)service=new ProjectEvidenceService();return service;}
