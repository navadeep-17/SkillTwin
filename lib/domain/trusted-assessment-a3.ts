import type { CompetencyObservation } from "./evidence-estimator-a3.js";
import { getReviewedQuestionMapping } from "./assessment-question-mapping-a3.js";

export const VERIFIED_ATTEMPT_ADAPTER_A3_VERSION="verified-assessment-adapter-a3-1";

export interface TrustedGradedAttemptRow {
  attemptId:string;
  assessmentId:string;
  skillId:string;
  skillSlug:string;
  bankQuestionId:string|null;
  bankConceptId:string;
  questionConceptIds:readonly string[];
  bankVersion:string;
  questionType:string;
  bankQuestionType:string;
  questionDifficulty:number;
  bankDifficulty:number;
  bankActive:boolean;
  assessmentStatus:string;
  attemptStatus:string;
  evaluationVersion:string;
  score:number;
  evaluatorConfidence:number;
}

export function mapTrustedGradedAttemptToCompetency(
  attempt:Readonly<TrustedGradedAttemptRow>
):CompetencyObservation | null {
  const reviewed=attempt.bankQuestionId?getReviewedQuestionMapping(attempt.bankQuestionId):null;
  if(!reviewed)return null;
  // Every field comes from a joined, user-scoped server-side DB query.
  // Unknown bank versions, edited concepts, generated questions, incomplete
  // assessments, or untrusted evaluators must not create verified observations.
  if (attempt.skillSlug!==reviewed.skillSlug
    || attempt.bankConceptId!==reviewed.conceptId
    || !attempt.questionConceptIds.includes(reviewed.conceptId)
    || attempt.bankVersion!==reviewed.bankVersion
    || !attempt.bankActive
    || attempt.questionType!==reviewed.questionType
    || attempt.bankQuestionType!==reviewed.questionType
    || attempt.questionDifficulty!==attempt.bankDifficulty
    || !Number.isInteger(attempt.questionDifficulty)
    || attempt.questionDifficulty<1||attempt.questionDifficulty>4
    || attempt.assessmentStatus!=="COMPLETED"
    || attempt.attemptStatus!=="EVALUATED"
    || attempt.evaluationVersion!=="hybrid-rubric-evaluator-e2"
    || !Number.isFinite(attempt.evaluatorConfidence)
    || attempt.evaluatorConfidence<0.99
    || !Number.isFinite(attempt.score)) return null;
  // MCQ evaluator is deterministic, exact 0/1 grading.
  if(attempt.score!==0&&attempt.score!==1)return null;
  if(!attempt.attemptId||!attempt.assessmentId||!attempt.skillId)return null;
  return {
    evidenceId:attempt.attemptId,
    sourceGroupId:"assessment:"+attempt.assessmentId,
    criterionId:reviewed.criterionId,
    sourceType:"ASSESSMENT_QUESTION",
    outcome:attempt.score===1?"SUPPORTS":"CONTRADICTS",
    evaluationKind:"KNOWLEDGE_CHECK"
  };
}
