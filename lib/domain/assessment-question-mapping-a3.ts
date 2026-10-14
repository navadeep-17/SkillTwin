import { getCompetencyRubric } from "./competency-rubrics-a3.js";

export const QUESTION_MAPPING_A3_VERSION = "question-criterion-mapping-a3-reviewed-pilot1";

/**
 * Hand-reviewed, explicitly identified questions from committed SQL seed files.
 * These MCQs check conceptual knowledge only; they are NEVER sufficient
 * to demonstrate an implementation-oriented competency.
 *
 * This allowlist is intentionally incomplete. Unknown, reworded, generated, or
 * unreviewed questions are not promoted to a criterion observation.
 */
export interface ReviewedQuestionMapping {
  readonly questionId: string;
  readonly skillSlug: string;
  readonly conceptId: string;
  readonly bankVersion: string;
  readonly questionType: "MCQ";
  readonly criterionId: string;
  readonly evaluationKind: "KNOWLEDGE_CHECK";
  readonly mappingVersion: typeof QUESTION_MAPPING_A3_VERSION;
}

function mapped(
  questionId:string,skillSlug:string,conceptId:string,bankVersion:string,criterionSuffix:string
):ReviewedQuestionMapping {
  const rubric=getCompetencyRubric(skillSlug);
  if(!rubric || !rubric.criteria.some(c=>c.id===skillSlug+"."+criterionSuffix))
    throw new Error("INVALID_REVIEWED_COMPETENCY_MAPPING");
  return Object.freeze({
    questionId,skillSlug,conceptId,bankVersion,
    questionType:"MCQ" as const,
    criterionId:skillSlug+"."+criterionSuffix,
    evaluationKind:"KNOWLEDGE_CHECK" as const,
    mappingVersion:QUESTION_MAPPING_A3_VERSION
  });
}

const manifest: readonly ReviewedQuestionMapping[]=Object.freeze([
  // supabase/seed.sql — REST bank e1: conceptual HTTP knowledge, not API implementation.
  mapped("40000000-0000-0000-0000-000000000001","rest-api","http-method-semantics","rest-bank-e1","http-semantics"),
  mapped("40000000-0000-0000-0000-000000000002","rest-api","status-codes","rest-bank-e1","http-semantics"),
  mapped("40000000-0000-0000-0000-000000000003","rest-api","resource-design","rest-bank-e1","resource-routing"),
  mapped("40000000-0000-0000-0000-000000000004","rest-api","put-vs-patch","rest-bank-e1","http-semantics"),
  mapped("40000000-0000-0000-0000-000000000005","rest-api","idempotency","rest-bank-e1","idempotency"),

  // supabase/migrations/0015_core_mcq_coverage.sql.
  mapped("40000000-0000-0000-0000-000000000301","authentication","session-vs-token","core-mcq-f1","session-basics"),
  mapped("40000000-0000-0000-0000-000000000302","authentication","authorization","core-mcq-f1","authorization"),
  mapped("40000000-0000-0000-0000-000000000303","docker","images-containers","core-mcq-f1","build-run"),
  mapped("40000000-0000-0000-0000-000000000307","sql","joins","core-mcq-f1","join"),
  mapped("40000000-0000-0000-0000-000000000308","sql","grouping","core-mcq-f1","aggregation"),

  // supabase/migrations/0022_additional_role_assessment_banks.sql.
  mapped("72000000-0000-0000-0000-000000000001","python","collections","role-bank-h1","collections"),
  mapped("72000000-0000-0000-0000-000000000002","python","exceptions","role-bank-h1","testing-errors"),
  mapped("72000000-0000-0000-0000-000000000003","python","comprehensions","role-bank-h1","collections")
]);
const byId=new Map(manifest.map(x=>[x.questionId,x]));
if(byId.size!==manifest.length)throw new Error("DUPLICATE_QUESTION_CRITERION_MAPPING");

export function getReviewedQuestionMapping(id:string):ReviewedQuestionMapping | null {
  return byId.get(id)??null;
}
export function listReviewedQuestionMappings():readonly ReviewedQuestionMapping[]{
  return manifest;
}
