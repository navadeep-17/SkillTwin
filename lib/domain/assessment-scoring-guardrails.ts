/**
 * Assessment scoring guardrails (a2).
 *
 * This is an intentionally conservative, inspectable HEURISTIC, not an
 * empirically calibrated probability, IRT model, or hiring prediction.
 *
 * Raw assessment percentage remains a difficulty-weighted accuracy metric.
 * The evidence level signal separately respects the difficulty of the
 * questions the learner actually attempted, so a short easy quiz cannot
 * establish advanced proficiency. Confidence reflects limited observations
 * and evaluator reliability, rather than being close to 1.0 by default.
 */
export const ASSESSMENT_SCORING_VERSION = "assessment-aggregator-e2";
export const LEGACY_ASSESSMENT_SCORING_VERSION = "assessment-aggregator-e1";

export interface AssessmentScoringAttempt {
  score:number;
  difficulty:number;
  evaluatorConfidence:number;
  conceptId:string;
}
export interface AssessmentScoringResult {
  normalizedScore:number;
  levelSignal:number;
  assessmentConfidence:number;
  meanDifficulty:number;
  meanEvaluatorConfidence:number;
  questionCount:number;
  distinctConceptCount:number;
  scoringVersion:typeof ASSESSMENT_SCORING_VERSION | typeof LEGACY_ASSESSMENT_SCORING_VERSION;
}

const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const round=(value:number,precision:number)=>Number(value.toFixed(precision));

export function calculateAssessmentSignals(input:{
  attempts:readonly AssessmentScoringAttempt[];
  coverage:number;
}):AssessmentScoringResult {
  const {attempts}=input;
  if(!attempts.length)throw new Error("ASSESSMENT_HAS_NO_ATTEMPTS");
  if(!Number.isFinite(input.coverage)||input.coverage<0||input.coverage>1)
    throw new Error("INVALID_ASSESSMENT_COVERAGE");

  let totalWeight=0;
  let weightedScore=0;
  let weightedDifficulty=0;
  let demonstratedDifficulty=0;
  let weightedEvaluator=0;
  const concepts=new Set<string>();

  for(const row of attempts){
    if(!Number.isFinite(row.score)||row.score<0||row.score>1
      ||!Number.isInteger(row.difficulty)||row.difficulty<1||row.difficulty>4
      ||!Number.isFinite(row.evaluatorConfidence)||row.evaluatorConfidence<0||row.evaluatorConfidence>1)
      throw new Error("INVALID_ASSESSMENT_SIGNAL");

    const weight=0.8+0.1*row.difficulty;
    totalWeight+=weight;
    weightedScore+=weight*row.score;
    weightedDifficulty+=weight*row.difficulty;
    demonstratedDifficulty+=weight*row.score*row.difficulty;
    weightedEvaluator+=weight*row.evaluatorConfidence;
    if(row.conceptId.trim())concepts.add(row.conceptId.trim());
  }

  const normalizedScore=weightedScore/totalWeight;
  const meanDifficulty=weightedDifficulty/totalWeight;
  const meanEvaluatorConfidence=weightedEvaluator/totalWeight;
  const breadth=Math.min(1,concepts.size/Math.min(attempts.length,4));

  // Difficulty 1: 100% -> 1.00 (BEGINNER).
  // Difficulty 2: 100% -> 1.65 (INTERMEDIATE).
  // Difficulty 3: 100% -> 2.30 (INTERMEDIATE).
  // Difficulty 4: 100% -> 2.95 (ADVANCED).
  // No short assessment, regardless of score, can grant EXPERT.
  // Incorrect difficult items MUST NOT increase estimated capability.
  const levelSignal=clamp(0.35+0.65*demonstratedDifficulty/totalWeight,0,3.20);

  // A confidence indicator only; not P(skill prediction is correct).
  // Four perfect MCQs with full coverage score around 0.69, not 0.90.
  const assessmentConfidence=clamp(
    0.20
      +0.18*input.coverage
      +0.20*Math.min(attempts.length/8,1)
      +0.17*meanEvaluatorConfidence
      +0.04*breadth,
    0.10,0.85
  );

  return {
    normalizedScore:round(normalizedScore,4),
    levelSignal:round(levelSignal,3),
    assessmentConfidence:round(assessmentConfidence,4),
    meanDifficulty:round(meanDifficulty,3),
    meanEvaluatorConfidence:round(meanEvaluatorConfidence,3),
    questionCount:attempts.length,
    distinctConceptCount:concepts.size,
    scoringVersion:ASSESSMENT_SCORING_VERSION
  };
}


/**
 * Preserve the production e1 estimator for instant rollback and deterministic
 * A/B comparisons. This does not recompute historical evidence.
 */
export function calculateLegacyAssessmentSignals(input:{
  attempts:readonly AssessmentScoringAttempt[];
  coverage:number;
}):AssessmentScoringResult {
  const next=calculateAssessmentSignals(input); // shared input validation and metrics
  let weightedScore=0;
  let totalWeight=0;
  for(const attempt of input.attempts){
    const weight=0.8+0.1*attempt.difficulty;
    weightedScore+=attempt.score*weight;
    totalWeight+=weight;
  }
  const normalizedScore=weightedScore/totalWeight;
  return {
    ...next,
    normalizedScore:round(normalizedScore,4),
    levelSignal:round(clamp(0.4+normalizedScore*2.5,0.4,3.5),3),
    assessmentConfidence:round(Math.min(0.95,
      0.58+0.22*input.coverage+0.15*Math.min(input.attempts.length/6,1)),4),
    scoringVersion:LEGACY_ASSESSMENT_SCORING_VERSION
  };
}

export function selectAssessmentSignals(input:{
  attempts:readonly AssessmentScoringAttempt[];
  coverage:number;
},enableA2:boolean):AssessmentScoringResult {
  return enableA2?calculateAssessmentSignals(input):calculateLegacyAssessmentSignals(input);
}
