import "server-only";
import { getSql } from "@/lib/db/postgres";
import { COMPETENCY_RUBRIC_VERSION, getCompetencyRubric } from "@/lib/domain/competency-rubrics-a3";
import { parsePublicGitHubRepo } from "@/lib/domain/project-defense";
import { inspectPublicRepository } from "@/lib/services/projects/project-defense-service";

export interface PracticalReviewRequest {
  learnerUserId:string;
  projectId:string;
  criterionId:string;
  commitSha:string;
  reviewedSourcePath:string;
  verdict:"PASS"|"FAIL";
  practicalTask:string;
  observedResult:string;
  testProcedure:string;
  observedLearnerLive:true;
}
export class PracticalReviewError extends Error {
  constructor(readonly code:string){super(code)}
}
type Row=Record<string,unknown>;
const rows=(x:unknown)=>x as Row[];
const sha=/^[a-f0-9]{40}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Reviewer privilege is checked INSIDE the transaction and belongs to the
 * authenticated reviewer. Learner/browser cannot choose the reviewer identity
 * or evidence source/type. This is a human-attested practical observation,
 * not sandboxed execution, authorship certification or a standardized exam.
 */
export async function submitPracticalReview(input:PracticalReviewRequest,reviewerId:string){
  if(process.env.SKILLTWIN_EVIDENCE_A3_ENABLED!=="true")
    throw new PracticalReviewError("PILOT_DISABLED");
  if(!UUID.test(reviewerId)||!UUID.test(input.learnerUserId)||!UUID.test(input.projectId)
    ||reviewerId===input.learnerUserId || input.observedLearnerLive!==true
    ||!sha.test(input.commitSha))throw new PracticalReviewError("INVALID_REVIEW");
  const sql=getSql();
  // FIRST privilege gate: do not reveal project existence or spend remote
  // GitHub requests before verifying that this signed-in user is a reviewer.
  const access=rows(await sql.unsafe(
    "select user_id from public.competency_reviewers where user_id=$1::uuid and active=true",
    [reviewerId]
  ));
  if(!access.length)throw new PracticalReviewError("REVIEWER_NOT_AUTHORIZED");
  // Preflight the source using existing bounded public-repo inspector;
  // no arbitrary commands or learner-authored code are executed on the server.
  const project=rows(await sql.unsafe(
    "select user_id,artifact_url,version,status from public.profile_projects where id=$1::uuid and user_id=$2::uuid",
    [input.projectId,input.learnerUserId]
  ))[0];
  const url=typeof project?.artifact_url==="string"?project.artifact_url:"";
  if(!project || project.status!=="ACTIVE" || !parsePublicGitHubRepo(url))
    throw new PracticalReviewError("PROJECT_NOT_ELIGIBLE");
  const inspected=await inspectPublicRepository(url);
  if(inspected.commitSha.toLowerCase()!==input.commitSha.toLowerCase())
    throw new PracticalReviewError("REPOSITORY_CHANGED_RESTART");
  const reviewed=inspected.sources.find(s=>s.path===input.reviewedSourcePath);
  if(!reviewed || !/^[a-f0-9]{40}$/i.test(reviewed.blobSha))
    throw new PracticalReviewError("SOURCE_NOT_REVIEWABLE");
  const parts=parsePublicGitHubRepo(url)!;
  const pinnedUrl="https://github.com/"+parts.owner+"/"+parts.repo;
  if(url!==pinnedUrl)
    throw new PracticalReviewError("PROJECT_NOT_ELIGIBLE"); // canonical immutable repo URL only

  const criterionSkill=input.criterionId.split(".")[0];
  const rubric=getCompetencyRubric(criterionSkill);
  if(!rubric || !rubric.criteria.some(c=>c.id===input.criterionId))
    throw new PracticalReviewError("CRITERION_NOT_REVIEWED");

  return sql.begin(async tx=>{
    const reviewers=rows(await tx.unsafe(
      "select user_id from public.competency_reviewers where user_id=$1::uuid and active=true for share",
      [reviewerId]
    ));
    if(!reviewers.length)throw new PracticalReviewError("REVIEWER_NOT_AUTHORIZED");
    const projects=rows(await tx.unsafe(
      "select user_id,artifact_url,version,status from public.profile_projects where id=$1::uuid and user_id=$2::uuid for share",
      [input.projectId,input.learnerUserId]
    ));
    if(!projects[0] || projects[0].status!=="ACTIVE"
      || String(projects[0].artifact_url)!==url
      || Number(projects[0].version)!==Number(project.version))
      throw new PracticalReviewError("PROJECT_CHANGED_RESTART");
    const skillRows=rows(await tx.unsafe(
      "select id from public.skills where slug=$1 and is_active=true limit 1",
      [criterionSkill]
    ));
    if(!skillRows[0])throw new PracticalReviewError("RUBRIC_SKILL_NOT_FOUND");
    const inserted=rows(await tx.unsafe(
      `insert into public.competency_practical_reviews(
         learner_user_id,reviewer_user_id,project_id,project_version,skill_id,
         criterion_id,rubric_version,repository_url,commit_sha,
         reviewed_source_path,reviewed_blob_sha,review_method,
         practical_task,observed_result,test_procedure,verdict)
       values($1::uuid,$2::uuid,$3::uuid,$4,$5::uuid,$6,$7,$8,$9,
         $10,$11,'OBSERVED_PRACTICAL_DEMO',$12,$13,$14,$15)
       on conflict do nothing returning id,reviewed_at`,
      [input.learnerUserId,reviewerId,input.projectId,Number(project.version),
        String(skillRows[0].id),input.criterionId,COMPETENCY_RUBRIC_VERSION,
        pinnedUrl,input.commitSha.toLowerCase(),reviewed.path,reviewed.blobSha.toLowerCase(),
        input.practicalTask,input.observedResult,input.testProcedure,input.verdict]
    ));
    if(!inserted[0])throw new PracticalReviewError("ALREADY_REVIEWED");
    return {
      reviewId:String(inserted[0].id),
      reviewedAt:String(inserted[0].reviewed_at),
      skillSlug:criterionSkill,criterionId:input.criterionId,
      reviewedSourcePath:reviewed.path,
      verdict:input.verdict,
      disclaimer:"Independent reviewer-attested live practical demonstration. This does not establish code authorship, calibrated ability, or production readiness."
    };
  });
}
