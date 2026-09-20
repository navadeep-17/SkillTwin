export interface AdaptiveConceptTarget {
  conceptId: string;
  minObservations: number;
}

export interface AdaptiveBlueprint {
  conceptTargets: AdaptiveConceptTarget[];
  difficultyMin: number;
  difficultyMax: number;
  startDifficulty: number;
  minItems: number;
  maxItems: number;
  targetCoverage: number;
  stopConfidence: number;
}

export interface AdaptiveAttempt {
  bankQuestionId: string;
  conceptId: string;
  difficulty: number;
  score: number;
  type: string;
  evaluatorConfidence?: number;
}

export interface AdaptiveCandidate {
  id: string;
  conceptId: string;
  difficulty: number;
  type: string;
}

export interface AdaptiveState {
  answered: number;
  coverage: number;
  confidence: number;
  shouldStop: boolean;
  targetConceptId: string | null;
  nextDifficulty: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function adaptiveAssessmentState(
  blueprint: AdaptiveBlueprint,
  attempts: AdaptiveAttempt[]
): AdaptiveState {
  const targetIds = blueprint.conceptTargets.map(target => target.conceptId);
  const counts = new Map<string, number>();
  const scores = new Map<string, { sum: number; count: number }>();

  for (const attempt of attempts) {
    counts.set(attempt.conceptId, (counts.get(attempt.conceptId) ?? 0) + 1);
    const current = scores.get(attempt.conceptId) ?? { sum: 0, count: 0 };
    current.sum += clamp(attempt.score, 0, 1);
    current.count += 1;
    scores.set(attempt.conceptId, current);
  }

  const covered = targetIds.filter(id => (counts.get(id) ?? 0) > 0).length;
  const coverage = targetIds.length ? covered / targetIds.length : 0;

  const evaluatorConfidence = attempts.length
    ? attempts.reduce((sum, attempt) => sum + clamp(attempt.evaluatorConfidence ?? 1, 0, 1), 0) / attempts.length
    : 0;
  const decisiveness = attempts.length
    ? attempts.reduce((sum, attempt) => sum + Math.abs(clamp(attempt.score, 0, 1) - 0.5) * 2, 0) / attempts.length
    : 0;
  const observationStrength = Math.min(1, attempts.length / Math.max(blueprint.minItems, 1));
  const confidence = clamp(
    0.20
      + 0.30 * observationStrength
      + 0.25 * coverage
      + 0.15 * evaluatorConfidence
      + 0.10 * decisiveness,
    0,
    0.95
  );

  const underObserved = blueprint.conceptTargets
    .filter(target => (counts.get(target.conceptId) ?? 0) < Math.max(1, target.minObservations))
    .sort((a, b) => {
      const countDelta = (counts.get(a.conceptId) ?? 0) - (counts.get(b.conceptId) ?? 0);
      return countDelta || a.conceptId.localeCompare(b.conceptId);
    });

  let targetConceptId: string | null = underObserved[0]?.conceptId ?? null;
  if (!targetConceptId && targetIds.length) {
    targetConceptId = [...targetIds].sort((left, right) => {
      const leftScore = scores.get(left);
      const rightScore = scores.get(right);
      const leftAverage = leftScore ? leftScore.sum / leftScore.count : 0.5;
      const rightAverage = rightScore ? rightScore.sum / rightScore.count : 0.5;
      if (leftAverage !== rightAverage) return leftAverage - rightAverage;
      const countDelta = (counts.get(left) ?? 0) - (counts.get(right) ?? 0);
      return countDelta || left.localeCompare(right);
    })[0] ?? null;
  }

  const last = attempts.at(-1);
  let nextDifficulty = last?.difficulty ?? blueprint.startDifficulty;
  if (last) {
    if (last.score >= 0.8) nextDifficulty += 1;
    else if (last.score < 0.5) nextDifficulty -= 1;
  }
  nextDifficulty = clamp(
    Math.round(nextDifficulty),
    blueprint.difficultyMin,
    blueprint.difficultyMax
  );

  const shouldStop = attempts.length >= blueprint.maxItems
    || (
      attempts.length >= blueprint.minItems
      && coverage >= blueprint.targetCoverage
      && confidence >= blueprint.stopConfidence
    );

  return {
    answered: attempts.length,
    coverage: Number(coverage.toFixed(4)),
    confidence: Number(confidence.toFixed(4)),
    shouldStop,
    targetConceptId,
    nextDifficulty
  };
}

export function selectAdaptiveCandidate(
  blueprint: AdaptiveBlueprint,
  attempts: AdaptiveAttempt[],
  candidates: AdaptiveCandidate[]
): AdaptiveCandidate | null {
  const state = adaptiveAssessmentState(blueprint, attempts);
  const usedIds = new Set(attempts.map(attempt => attempt.bankQuestionId));
  const typeCounts = new Map<string, number>();
  for (const attempt of attempts) {
    typeCounts.set(attempt.type, (typeCounts.get(attempt.type) ?? 0) + 1);
  }

  const available = candidates.filter(candidate => !usedIds.has(candidate.id));
  if (!available.length) return null;

  return [...available].sort((a, b) => {
    const aConcept = a.conceptId === state.targetConceptId ? 0 : 1;
    const bConcept = b.conceptId === state.targetConceptId ? 0 : 1;
    if (aConcept !== bConcept) return aConcept - bConcept;

    const aDifficulty = Math.abs(a.difficulty - state.nextDifficulty);
    const bDifficulty = Math.abs(b.difficulty - state.nextDifficulty);
    if (aDifficulty !== bDifficulty) return aDifficulty - bDifficulty;

    const aTypeCount = typeCounts.get(a.type) ?? 0;
    const bTypeCount = typeCounts.get(b.type) ?? 0;
    if (aTypeCount !== bTypeCount) return aTypeCount - bTypeCount;

    const typeRank = (value: string) => value === "MCQ" ? 0 : value === "SHORT_TEXT" ? 1 : 2;
    const typeDelta = typeRank(a.type) - typeRank(b.type);
    if (typeDelta !== 0) return typeDelta;

    return a.id.localeCompare(b.id);
  })[0] ?? null;
}
