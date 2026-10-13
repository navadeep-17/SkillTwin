/** Pure, testable routing for Journey Chat. No learner data or mutations here. */
export type JourneyIntent =
  | "EXPLAIN_ASSESSMENT"
  | "WHY_ROADMAP_CHANGED"
  | "WHAT_NEXT"
  | "READINESS"
  | "SKILL_STATUS"
  | "UNDO_ROADMAP_CHANGE"
  | "START_ASSESSMENT"
  | "GENERATE_PLAN"
  | "JOURNEY_SUMMARY";

export function classifyJourneyIntent(message: string): JourneyIntent {
  const text = message.toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, " ")
    .replace(/\s+/g, " ").trim();

  // An explicit mutation request remains an approval-gated proposal.
  if (/\b(undo|revert|roll back|rollback)\b/.test(text)) return "UNDO_ROADMAP_CHANGE";
  if (/\b(challenge me|test me|quiz me|assess me|validate me)\b/.test(text)) return "START_ASSESSMENT";
  if (/\b(generate|create|build)\b.*\b(plan|roadmap)\b/.test(text)) return "GENERATE_PLAN";

  // "Why didn't my roadmap change?" is not a request to explain some
  // unrelated recent PlanDiff. It requires this assessment's stored NO_OP.
  const explanatory = /\b(why|explain)\b/.test(text)
    || (/\b(what|how)\b/.test(text) && /\b(changed|happened|after|result)\b/.test(text));
  const noChange = /\b(didn|did not|not|no|never|unchanged|same|stayed)\b/.test(text)
    && /\b(roadmap|plan|replan)\b/.test(text);
  const assessedState = /\b(assessment|quiz|challenge|test result|skill estimate|skill level|confidence|proficiency|capability|score)\b/.test(text)
    || /\b(drop|dropped|decrease|decreased|lowered|went down)\b/.test(text);
  if (explanatory && (noChange || assessedState)) return "EXPLAIN_ASSESSMENT";

  if (/\bwhy\b.*\b(roadmap|plan)\b.*\b(change|changed|update|updated)\b/.test(text)
    || /\bwhy did.*change\b/.test(text)) return "WHY_ROADMAP_CHANGED";
  if (/\b(what next|next task|do next|learn next|today|this week)\b/.test(text)) return "WHAT_NEXT";
  if (/\b(readiness|ready for|how ready)\b/.test(text)) return "READINESS";
  if (/\b(skill|confidence|capability|level|gap)\b/.test(text)) return "SKILL_STATUS";
  return "JOURNEY_SUMMARY";
}

/** Match complete skill names, not substrings ("Java" must not match "JavaScript"). */
export function findMentionedSkill<T extends Record<string, unknown>>(
  message: string, skills: T[]
): T | null {
  const normalized = (s: string) => s.toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, " ").replace(/\s+/g, " ").trim();
  const text = " " + normalized(message) + " ";
  // Prefer a longer, more specific name if multiple complete names occur.
  const candidates = skills.flatMap(skill => {
    const names = [String(skill.canonical_name ?? ""), String(skill.slug ?? "")];
    return names.map(name => ({skill, term:normalized(name)}));
  }).filter(item => Boolean(item.term) && text.includes(" " + item.term + " "));
  candidates.sort((a,b)=>b.term.length-a.term.length);
  return candidates[0]?.skill ?? null;
}
