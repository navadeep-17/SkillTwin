import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { getSql } from "@/lib/db/postgres";
import { getEvidenceEngine } from "@/lib/services/skills/evidence-service";
import { getGapAnalysisService } from "@/lib/services/gaps/gap-analysis-service";
import { getInitialPlanService } from "@/lib/services/planner/initial-plan-service";
import { PostgresProfileAnalysisRepository } from "@/lib/repositories/postgres/profile-analysis-repository";
import { segmentResume } from "@/lib/profile/segmenter";
import { extractMappedSkills } from "@/lib/profile/skill-mapper";
import { extractSemanticSkillEvidence, mergeProfileExtractions } from "@/lib/profile/semantic-extractor";
import { extractStructuredProfile } from "@/lib/profile/profile-structure-extractor";
import type { EvidenceCandidate } from "@/lib/domain/skills";

export const MANUAL_PROFILE_ANALYZER_VERSION="manual-profile-b1";
type Row=Record<string,unknown>;
const rows=(value:unknown)=>value as Row[];

function conservativeManualEvidence(candidate:EvidenceCandidate,sourceId:string,version:number):EvidenceCandidate{
  const signal=candidate.levelSignal==null?null:Math.min(2.25,Math.max(0.5,candidate.levelSignal));
  return {
    ...candidate,
    sourceType:"MANUAL_SELF_REPORT",
    sourceRef:candidate.sourceRef,
    sourceGroupId:"manual:"+sourceId+":v"+version+":"+candidate.sourceRef,
    levelSignal:signal,
    directness:Math.min(candidate.directness,0.78),
    quality:Math.min(candidate.quality,0.50),
    coverage:Math.min(candidate.coverage,0.40),
    metadata:{
      ...(candidate.metadata ?? {}),
      sourceKind:"manual_profile",
      sourceId,
      sourceVersion:version,
      originalProposedSourceType:candidate.sourceType,
      analyzerVersion:MANUAL_PROFILE_ANALYZER_VERSION
    },
    idempotencyKey:"manual-profile:"+sourceId+":v"+version+":"+candidate.skillId+":"+candidate.sourceRef
  };
}

export class ManualProfileService{
  constructor(private readonly repository=new PostgresProfileAnalysisRepository()){}

  async createAndAnalyze(input:{userId:string;title:string;text:string;deferPlan?:boolean}){
    const sql=getSql();
    const source=rows(await sql.unsafe(
      "insert into public.profile_manual_sources(user_id,title,text_content,version,status) values ($1::uuid,$2,$3,1,'ACTIVE') returning *",
      [input.userId,input.title,input.text]
    ))[0];
    return this.analyzeRecord(input.userId,source,[],Boolean(input.deferPlan));
  }

  async updateAndAnalyze(input:{userId:string;sourceId:string;title?:string;text?:string;deferPlan?:boolean}){
    const sql=getSql();
    const current=rows(await sql.unsafe(
      "select * from public.profile_manual_sources where id=$1::uuid and user_id=$2::uuid and status='ACTIVE' limit 1",
      [input.sourceId,input.userId]
    ))[0];
    if(!current) throw new Error("MANUAL_SOURCE_NOT_FOUND");

    const oldEvidence=rows(await sql.unsafe(
      "select id,skill_id from public.skill_evidence where user_id=$1::uuid and source_group_id like $2 and status in ('ACCEPTED','NON_AGGREGATING')",
      [input.userId,"manual:"+input.sourceId+":v"+String(current.version)+":%"]
    ));
    const affected=[...new Set(oldEvidence.map(row=>String(row.skill_id)))];
    if(oldEvidence.length){
      await sql.unsafe(
        "update public.skill_evidence set status='SUPERSEDED' where user_id=$1::uuid and source_group_id like $2 and status in ('ACCEPTED','NON_AGGREGATING')",
        [input.userId,"manual:"+input.sourceId+":v"+String(current.version)+":%"]
      );
    }

    const next=rows(await sql.unsafe(
      "update public.profile_manual_sources set title=$1,text_content=$2,version=version+1,analysis_result=null where id=$3::uuid and user_id=$4::uuid returning *",
      [input.title ?? String(current.title),input.text ?? String(current.text_content),input.sourceId,input.userId]
    ))[0];
    return this.analyzeRecord(input.userId,next,affected,Boolean(input.deferPlan));
  }

  async list(userId:string){
    return rows(await getSql().unsafe(
      "select id,title,text_content,version,status,analysis_result,created_at,updated_at from public.profile_manual_sources where user_id=$1::uuid and status='ACTIVE' order by updated_at desc",
      [userId]
    ));
  }

  private async analyzeRecord(userId:string,source:Row,previouslyAffected:string[],deferPlan:boolean){
    const sql=getSql();
    const sourceId=String(source.id),version=Number(source.version),text=String(source.text_content);
    const analysisKey="manual_profile:"+sourceId+":v"+version+":"+MANUAL_PROFILE_ANALYZER_VERSION;
    const run=rows(await sql.unsafe(
      "insert into public.profile_analysis_runs(user_id,source_type,source_id,source_version,analyzer_schema_version,analysis_key,status,stage,progress_percent,started_at) values ($1::uuid,'manual_profile',$2::uuid,$3,$4,$5,'running','normalizing',10,now()) on conflict(user_id,analysis_key) do update set analysis_key=excluded.analysis_key returning *",
      [userId,sourceId,version,MANUAL_PROFILE_ANALYZER_VERSION,analysisKey]
    ))[0];
    const runId=String(run.id);
    if(String(run.status)==="complete" && run.evidence_batch_result) return {sourceId,runId,reused:true,result:run.evidence_batch_result};

    try{
      const blocks=segmentResume({
        documentId:sourceId,
        documentVersion:version,
        pages:[{page:1,text}]
      }).map(block=>({...block,pageStart:null,pageEnd:null}));

      await sql.unsafe(
        "update public.profile_analysis_runs set stage='mapping',progress_percent=45,counts=$1::jsonb where id=$2::uuid and user_id=$3::uuid",
        [JSON.stringify({blocks:blocks.length}),runId,userId]
      );
      const catalog=await this.repository.listCatalog();
      const deterministic=extractMappedSkills({blocks,catalog,documentId:sourceId,documentVersion:version});
      let semantic=null;
      const warnings:string[]=[];
      try{
        semantic=await extractSemanticSkillEvidence({blocks,catalog,documentId:sourceId,documentVersion:version});
      }catch(error){
        warnings.push("AI_SEMANTIC_EXTRACTION_FAILED");
        console.error("manual_profile.semantic.failed",{runId,error:error instanceof Error?error.message:String(error)});
      }
      const merged=mergeProfileExtractions(deterministic,semantic);
      const evidence=merged.evidence.map(item=>conservativeManualEvidence(item,sourceId,version));
      const structuredProfile=await extractStructuredProfile({
        blocks,
        catalog,
        sourceKind:"manual_profile"
      });

      await this.repository.replaceBlocksAndClaims({userId,runId,sourceId,blocks,claims:merged.claims});
      await this.repository.saveStructuredProfile(userId,runId,structuredProfile);
      await sql.unsafe(
        "update public.profile_analysis_runs set stage='evidence',progress_percent=75,counts=$1::jsonb,warnings=$2::jsonb where id=$3::uuid and user_id=$4::uuid",
        [JSON.stringify({blocks:blocks.length,mappedClaims:merged.claims.length,evidenceCandidates:evidence.length,unresolvedTerms:structuredProfile.unresolvedTerms.length}),JSON.stringify([...warnings,...structuredProfile.warnings]),runId,userId]
      );

      const evidenceResult=await getEvidenceEngine().ingestBatch({
        userId,
        trigger:{type:"MANUAL_PROFILE_ANALYSIS",ref:runId},
        candidates:evidence,
        producerVersion:MANUAL_PROFILE_ANALYZER_VERSION
      });
      const recomputed=previouslyAffected.length
        ? await getEvidenceEngine().recomputeSkills({userId,skillIds:previouslyAffected,trigger:{type:"MANUAL_PROFILE_REANALYSIS",ref:runId}})
        : {deltas:[],downstream:{runGapAnalysis:false,considerReplan:false}};
      const shouldGap=evidenceResult.downstream.runGapAnalysis || recomputed.downstream.runGapAnalysis;
      const gap=shouldGap?await getGapAnalysisService().recompute(userId,{type:"MANUAL_PROFILE_SKILL_DELTA",ref:runId}):null;
      let plan:unknown=null;
      if(gap && !deferPlan){
        try{plan=await getInitialPlanService().generate(userId);}catch(error){
          warnings.push("INITIAL_PLAN_GENERATION_FAILED");
          console.error("manual_profile.plan.failed",{runId,error:error instanceof Error?error.message:String(error)});
        }
      }

      const result={
        sourceId,runId,version,claims:merged.claims.length,structuredProfile,
        evidence:{...evidenceResult,deltas:[...evidenceResult.deltas,...recomputed.deltas]},
        gapAnalysis:gap?{snapshotId:gap.snapshotId,readiness:gap.readiness,evidenceCoverage:gap.evidenceCoverage}:null,
        plan,warnings
      };
      await sql.begin(async tx=>{
        await tx.unsafe(
          "update public.profile_analysis_runs set status='complete',stage='complete',progress_percent=100,counts=$1::jsonb,warnings=$2::jsonb,evidence_batch_result=$3::jsonb,completed_at=now() where id=$4::uuid and user_id=$5::uuid",
          [JSON.stringify({blocks:blocks.length,mappedClaims:merged.claims.length,evidenceAccepted:evidenceResult.acceptedEvidenceIds.length,unresolvedTerms:structuredProfile.unresolvedTerms.length}),JSON.stringify([...warnings,...structuredProfile.warnings]),JSON.stringify(result),runId,userId]
        );
        await tx.unsafe(
          "update public.profile_manual_sources set analysis_result=$1::jsonb where id=$2::uuid and user_id=$3::uuid",
          [JSON.stringify(result),sourceId,userId]
        );
        await tx.unsafe(
          "insert into public.agent_events(user_id,event_type,trigger_type,trigger_ref,summary,entity_refs,evidence_refs,metadata) values ($1::uuid,'profile.manual.processed','MANUAL_PROFILE',$2,$3,$4::jsonb,$5::jsonb,$6::jsonb)",
          [
            userId,sourceId,
            "Processed manual profile context across "+merged.claims.length+" canonical skill claim"+(merged.claims.length===1?"":"s")+".",
            JSON.stringify([{type:"manual_profile",id:sourceId}]),
            JSON.stringify(evidenceResult.acceptedEvidenceIds),
            JSON.stringify({
              version,
              analyzerVersion:MANUAL_PROFILE_ANALYZER_VERSION,
              skillsDetected:merged.claims.length,
              evidenceProposed:evidence.length,
              evidenceAccepted:evidenceResult.acceptedEvidenceIds.length,
              unresolvedTerms:structuredProfile.unresolvedTerms.length,
              warnings:[...warnings,...structuredProfile.warnings]
            })
          ]
        );
        await tx.unsafe("update public.users set onboarding_step=greatest(onboarding_step,2) where id=$1::uuid",[userId]);
      });
      return {sourceId,runId,reused:false,result};
    }catch(error){
      const message=error instanceof Error?error.message:String(error);
      await sql.unsafe(
        "update public.profile_analysis_runs set status='failed',stage='failed',error_code='MANUAL_PROFILE_ANALYSIS_FAILED',error_message=$1,completed_at=now() where id=$2::uuid and user_id=$3::uuid",
        [message.slice(0,1200),runId,userId]
      );
      throw error;
    }
  }
}

let service:ManualProfileService|null=null;
export function getManualProfileService(){if(!service) service=new ManualProfileService();return service;}
