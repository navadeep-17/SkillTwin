import "server-only";
import { getSql } from "@/lib/db/postgres";
import { addCompetencyVerification, type GapVerificationProjection } from "@/lib/domain/gap-verification-a3";
import { mapTrustedGradedAttemptToCompetency, type TrustedGradedAttemptRow, VERIFIED_ATTEMPT_ADAPTER_A3_VERSION } from "@/lib/domain/trusted-assessment-a3";
import { QUESTION_MAPPING_A3_VERSION } from "@/lib/domain/assessment-question-mapping-a3";
import type { CompetencyObservation } from "@/lib/domain/evidence-estimator-a3";
import { verifiedPracticalReviewObservation, type TrustedPracticalReview, PRACTICAL_REVIEW_A3_VERSION } from "@/lib/domain/trusted-practical-review-a3";
import type { GapAnalysis, GapResult } from "@/lib/domain/gap-engine";

type Row=Record<string,unknown>;
const rows=(value:unknown)=>value as Row[];
const asNumber=(v:unknown)=>Number(v??0);
const array=(v:unknown):unknown[]=>{
  if(Array.isArray(v))return v;
  if(typeof v==="string"){
    try {const result=JSON.parse(v);return Array.isArray(result)?result:[];} catch{return [];}
  }
  return [];
};
const obj=(v:unknown):Record<string,unknown>=>{
  if(v&&typeof v==="object"&&!Array.isArray(v))return v as Record<string,unknown>;
  if(typeof v==="string"){
    try {const result=JSON.parse(v);return result&&typeof result==="object"&&!Array.isArray(result)?result:{};}
    catch{return {};}
  }
  return {};
};
export type EvidenceA3Preview={
  projection:GapVerificationProjection;
  snapshotId:string;
  asOf:string;
  knowledgeObservationCount:number;
  practicalReviewObservationCount:number;
  scannedReviewCount:number;
  reviewsTruncated:boolean;
  practicalReviewVersion:string;
  unmappedOrUntrustedAttemptCount:number;
  scannedAttemptCount:number;
  attemptsTruncated:boolean;
  legacyEvidenceCountsBySkill:Record<string,number>;
  questionMappingVersion:string;
  adapterVersion:string;
  warning:string;
};

/**
 * Trust boundary: the userId MUST come from verified Supabase Auth, never a
 * URL param. All assessment rows are scope-joined against that user in SQL.
 * No answer keys, learner answers or raw resume text are read or returned.
 * This preview never updates evidence, skill estimates, gap snapshots or plans.
 */
export async function getEvidenceA3Preview(userId:string):Promise<EvidenceA3Preview|null>{
  const sql=getSql();
  const snapshots=rows(await sql.unsafe(
    "select id,role_version_id,readiness,evidence_coverage,selected_alternatives,as_of from public.gap_snapshots where user_id=$1::uuid order by created_at desc limit 1",
    [userId]
  ));
  if(!snapshots.length)return null;
  const snapshot=snapshots[0];
  const snapshotId=String(snapshot.id);
  const gapRows=rows(await sql.unsafe(
    "select g.*,s.slug from public.skill_gap_results g join public.skills s on s.id=g.skill_id where g.user_id=$1::uuid and g.snapshot_id=$2::uuid order by g.priority_score desc,s.canonical_name",
    [userId,snapshotId]
  ));
  const gaps:GapResult[]=gapRows.map(r=>({
    requirementId:String(r.requirement_id),
    groupId:String(r.group_id),
    skillId:String(r.skill_id),
    currentScore:r.current_score==null?null:Number(r.current_score),
    currentConfidence:asNumber(r.current_confidence),
    targetScore:asNumber(r.target_score),
    attainment:asNumber(r.attainment),
    gapSeverity:asNumber(r.gap_severity),
    dependencyImpact:asNumber(r.dependency_impact),
    urgency:asNumber(r.urgency),
    priorityScore:asNumber(r.priority_score),
    priorityBand:String(r.priority_band) as GapResult["priorityBand"],
    status:String(r.status) as GapResult["status"],
    recommendedAction:String(r.recommended_action) as GapResult["recommendedAction"],
    reasonCodes:array(r.reason_codes).map(String)
  }));
  const analysis:GapAnalysis={
    roleVersionId:String(snapshot.role_version_id),
    gaps,
    readiness:asNumber(snapshot.readiness),
    evidenceCoverage:asNumber(snapshot.evidence_coverage),
    selectedAlternatives:Object.fromEntries(Object.entries(obj(snapshot.selected_alternatives)).map(([k,v])=>[k,String(v)]))
  };
  const slugMap=Object.fromEntries(gapRows.map(r=>[String(r.skill_id),String(r.slug)]));
  const skillIds=[...new Set(gapRows.map(r=>String(r.skill_id)))];
  const attemptRows:Row[] = skillIds.length?rows(await sql.unsafe(
    `select a.id as attempt_id,a.assessment_id,sa.skill_id,s.slug as skill_slug,
        q.bank_question_id,q.concept_ids as question_concept_ids,q.type as question_type,
        q.difficulty as question_difficulty,
        b.concept_id as bank_concept_id,b.version as bank_version,
        b.type as bank_question_type,b.difficulty as bank_difficulty,b.is_active as bank_active,
        sa.status as assessment_status,a.status as attempt_status,a.evaluation_version,
        a.score,a.evaluator_confidence
      from public.skill_assessment_attempts a
      join public.skill_assessments sa on sa.id=a.assessment_id and sa.user_id=a.user_id
      join public.skill_assessment_questions q on q.id=a.question_id and q.assessment_id=sa.id
      join public.assessment_question_bank b on b.id=q.bank_question_id and b.skill_id=sa.skill_id
        and q.prompt=b.prompt and q.answer_key=b.answer_key
        and q.options is not distinct from b.options
      join public.skills s on s.id=sa.skill_id
      where a.user_id=$1::uuid and sa.status='COMPLETED' and a.status='EVALUATED'
        and sa.skill_id=any($2::uuid[])
      order by a.created_at desc,a.id
      limit 401`,
    [userId,skillIds]
  )):[];
  const knownAttempts=attemptRows.slice(0,400);
  const observationsBySkillId:Record<string,CompetencyObservation[]>={};
  let mapped=0;
  for(const row of knownAttempts){
    const input:TrustedGradedAttemptRow={
      attemptId:String(row.attempt_id),
      assessmentId:String(row.assessment_id),
      skillId:String(row.skill_id),
      skillSlug:String(row.skill_slug),
      bankQuestionId:row.bank_question_id==null?null:String(row.bank_question_id),
      bankConceptId:String(row.bank_concept_id),
      questionConceptIds:array(row.question_concept_ids).map(String),
      bankVersion:String(row.bank_version),
      questionType:String(row.question_type),
      bankQuestionType:String(row.bank_question_type),
      questionDifficulty:asNumber(row.question_difficulty),
      bankDifficulty:asNumber(row.bank_difficulty),
      bankActive:row.bank_active===true,
      assessmentStatus:String(row.assessment_status),
      attemptStatus:String(row.attempt_status),
      evaluationVersion:String(row.evaluation_version),
      score:Number(row.score),
      evaluatorConfidence:Number(row.evaluator_confidence)
    };
    const observation=mapTrustedGradedAttemptToCompetency(input);
    if(!observation)continue;
    (observationsBySkillId[input.skillId]??=[]).push(observation);
    mapped++;
  }
  const reviewRows:Row[]=skillIds.length?rows(await sql.unsafe(
    `select r.id,r.learner_user_id,r.reviewer_user_id,r.project_id,r.project_version,
        r.skill_id,r.criterion_id,r.rubric_version,r.repository_url,r.commit_sha,
        r.review_method,r.practical_task,r.observed_result,r.test_procedure,r.verdict,
        r.reviewed_source_path,r.reviewed_blob_sha,
        s.slug as skill_slug,p.artifact_url as project_repository_url,
        cr.active as reviewer_active
      from public.competency_practical_reviews r
      join public.profile_projects p on p.id=r.project_id and p.user_id=r.learner_user_id
        and p.status='ACTIVE' and p.version=r.project_version
      join public.competency_reviewers cr on cr.user_id=r.reviewer_user_id and cr.active=true
      join public.skills s on s.id=r.skill_id
      where r.learner_user_id=$1::uuid and r.skill_id=any($2::uuid[])
      order by r.reviewed_at desc,r.id limit 401`,
    [userId,skillIds]
  )):[];
  let trustedPracticalReviewCount=0;
  for(const row of reviewRows.slice(0,400)){
    const record:TrustedPracticalReview={
      id:String(row.id),learnerUserId:String(row.learner_user_id),
      reviewerUserId:String(row.reviewer_user_id),projectId:String(row.project_id),
      projectVersion:Number(row.project_version),skillId:String(row.skill_id),
      skillSlug:String(row.skill_slug),criterionId:String(row.criterion_id),
      rubricVersion:String(row.rubric_version),repositoryUrl:String(row.repository_url),
      projectRepositoryUrl:String(row.project_repository_url),
      commitSha:String(row.commit_sha),reviewedSourcePath:String(row.reviewed_source_path),
      reviewedBlobSha:String(row.reviewed_blob_sha),reviewMethod:String(row.review_method),
      verdict:String(row.verdict),reviewerActive:row.reviewer_active===true,
      practicalTask:String(row.practical_task),observedResult:String(row.observed_result),
      testProcedure:String(row.test_procedure)
    };
    const trusted=verifiedPracticalReviewObservation(record);
    if(trusted){
      (observationsBySkillId[record.skillId]??=[]).push(trusted);
      trustedPracticalReviewCount++;
    }
  }
  const evidenceCountRows:Row[]=skillIds.length?rows(await sql.unsafe(
    "select skill_id,count(*)::int as count from public.skill_evidence where user_id=$1::uuid and skill_id=any($2::uuid[]) and status in ('ACCEPTED','NON_AGGREGATING') group by skill_id",
    [userId,skillIds]
  )):[];
  const legacyEvidenceCountsBySkill=Object.fromEntries(evidenceCountRows.map(x=>[String(x.skill_id),asNumber(x.count)]));
  const projection=addCompetencyVerification({
    gapAnalysis:analysis,skillSlugsById:slugMap,observationsBySkillId
  });
  return {
    projection,snapshotId,
    asOf:String(snapshot.as_of??""),
    knowledgeObservationCount:mapped,
    practicalReviewObservationCount:trustedPracticalReviewCount,
    scannedReviewCount:Math.min(400,reviewRows.length),
    reviewsTruncated:reviewRows.length>400,
    practicalReviewVersion:PRACTICAL_REVIEW_A3_VERSION,
    unmappedOrUntrustedAttemptCount:knownAttempts.length-mapped,
    scannedAttemptCount:knownAttempts.length,
    attemptsTruncated:attemptRows.length>400,
    legacyEvidenceCountsBySkill,
    questionMappingVersion:QUESTION_MAPPING_A3_VERSION,
    adapterVersion:VERIFIED_ATTEMPT_ADAPTER_A3_VERSION,
    warning:"Preview only. MCQ knowledge checks do not prove implementation. Independent reviewer-attested live demonstrations are distinct from automatic code grading or authorship proof. Old A1 readiness and role gaps remain unchanged."
  };
}
