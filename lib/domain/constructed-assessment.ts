export interface ConstructedEvaluation {
  score: number;
  evaluatorConfidence: number;
  feedback: string;
  errorTag: string | null;
}

export interface ConstructedEvaluationInput {
  expectedKeywords: string[];
  conceptId?: string | null;
}

export function deterministicConstructedEvaluation(
  input: ConstructedEvaluationInput,
  answerText: string
): ConstructedEvaluation {
  const expectedKeywords = input.expectedKeywords.map(value => value.trim()).filter(Boolean);
  const normalized = answerText.toLowerCase();
  const matched = expectedKeywords.filter(keyword => normalized.includes(keyword.toLowerCase()));
  const score = expectedKeywords.length ? matched.length / expectedKeywords.length : 0.5;
  const conceptId = input.conceptId?.trim() || "concept_gap";

  return {
    score: Number(score.toFixed(3)),
    evaluatorConfidence: expectedKeywords.length ? 0.68 : 0.52,
    feedback: score >= 0.75
      ? "Your answer covers the main rubric concepts."
      : "Your answer is partially aligned with the rubric. Review the reference concepts and make the reasoning more explicit.",
    errorTag: score >= 0.75 ? null : conceptId
  };
}

export async function evaluateConstructedWithFallback(
  input: ConstructedEvaluationInput,
  answerText: string,
  evaluator: () => Promise<ConstructedEvaluation | null>
): Promise<ConstructedEvaluation> {
  const fallback = deterministicConstructedEvaluation(input, answerText);

  try {
    const evaluated = await evaluator();
    if (!evaluated) return fallback;
    if (!Number.isFinite(evaluated.score) || evaluated.score < 0 || evaluated.score > 1) return fallback;
    if (!Number.isFinite(evaluated.evaluatorConfidence) || evaluated.evaluatorConfidence < 0 || evaluated.evaluatorConfidence > 1) {
      return fallback;
    }
    if (!evaluated.feedback.trim()) return fallback;

    return {
      score: Number(evaluated.score.toFixed(3)),
      evaluatorConfidence: Number(evaluated.evaluatorConfidence.toFixed(3)),
      feedback: evaluated.feedback.trim(),
      errorTag: evaluated.errorTag?.trim()
        || (evaluated.score >= 0.75 ? null : input.conceptId?.trim() || "concept_gap")
    };
  } catch {
    return fallback;
  }
}
