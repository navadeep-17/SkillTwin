import type { CompetencyObservation } from "./evidence-estimator-a3.js";
import { COMPETENCY_RUBRIC_VERSION, getCompetencyRubric } from "./competency-rubrics-a3.js";

export const PRACTICAL_REVIEW_A3_VERSION = "reviewer-practical-a3-1";
export interface TrustedPracticalReview {
  id:string;
  learnerUserId:string;
  reviewerUserId:string;
  projectId:string;
  projectVersion:number;
  skillId:string;
  skillSlug:string;
  criterionId:string;
  rubricVersion:string;
  repositoryUrl:string;
  projectRepositoryUrl:string;
  commitSha:string;
  reviewMethod:string;
  verdict:string;
  reviewerActive:boolean;
  practicalTask:string;
  observedResult:string;
  testProcedure:string;
}
/** Data must originate from a user-scoped server DB join, never the browser. */
export function verifiedPracticalReviewObservation(
  record:Readonly<TrustedPracticalReview>
):CompetencyObservation|null {
  const rubric=getCompetencyRubric(record.skillSlug);
  if(!rubric || !rubric.criteria.some(c=>c.id===record.criterionId)
    || record.rubricVersion!==COMPETENCY_RUBRIC_VERSION
    || record.reviewerActive!==true
    || !record.learnerUserId || !record.reviewerUserId
    || record.learnerUserId===record.reviewerUserId
    || !record.id || !record.projectId || !record.skillId
    || !Number.isSafeInteger(record.projectVersion) || record.projectVersion<=0
    || record.repositoryUrl!==record.projectRepositoryUrl
    || !/^https:\/\/github\.com\/[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+$/.test(record.repositoryUrl)
    || !/^[a-f0-9]{40}$/.test(record.commitSha)
    || record.reviewMethod!=="OBSERVED_PRACTICAL_DEMO"
    || !["PASS","FAIL"].includes(record.verdict)
    || record.practicalTask.trim().length<50
    || record.observedResult.trim().length<50
    || record.testProcedure.trim().length<30) return null;
  return {
    evidenceId:record.id,
    sourceGroupId:"practical-review:"+record.projectId+":v"+record.projectVersion+":"+record.commitSha,
    criterionId:record.criterionId,
    sourceType:"PROJECT_ARTIFACT_VERIFIED",
    outcome:record.verdict==="PASS"?"SUPPORTS":"CONTRADICTS",
    evaluationKind:"INDEPENDENT_ARTIFACT_REVIEW"
  };
}
