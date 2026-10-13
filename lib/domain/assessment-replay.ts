/**
 * Same-key answer retries are safe only for the exact same learner-owned
 * assessment and question. A key reused on another question must not return
 * an unrelated attempt as if it were a successful submission.
 */
export function assessmentAnswerReplay(
  prior: { assessment_id: unknown; question_id: unknown } | null,
  assessmentId: string,
  questionId: string
): "NEW" | "REPLAY" | "CONFLICT" {
  if (!prior) return "NEW";
  if (String(prior.assessment_id) !== assessmentId) return "CONFLICT";
  if (String(prior.question_id) !== questionId) return "CONFLICT";
  return "REPLAY";
}
