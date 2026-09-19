export const PLANNER_VERSION = "learning-planner-d1";

export interface PlannerGap {
  requirementId: string;
  skillId: string;
  skillName: string;
  skillSlug: string;
  currentScore: number | null;
  currentConfidence: number;
  targetScore: number;
  priorityScore: number;
  priorityBand: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "COMPLETE";
  status: "STRONG" | "DEVELOPING" | "GAP";
  recommendedAction: "LEARN" | "VALIDATE" | "VALIDATE_FIRST" | "MAINTAIN";
  learningStage: 1 | 2 | 3 | 4;
}

export interface PlannerConstraints {
  hoursPerWeek: number;
  learningDays: string[];
  preferredSessionMinutes: number;
  minSessionMinutes: number;
}

export type GeneratedTaskType = "LEARN" | "PRACTICE" | "BUILD" | "VALIDATE";

export interface GeneratedTask {
  skillId: string;
  skillSlug: string;
  type: GeneratedTaskType;
  title: string;
  durationMinutes: number;
  day: string;
  flexible: boolean;
  difficulty: "BASIC" | "STANDARD" | "ADVANCED";
  rationaleCode: string;
  resourceTag: string | null;
}

export interface GeneratedObjective {
  skillId: string;
  requirementId: string;
  type: "ACQUIRE" | "VALIDATE_FIRST" | "REINFORCE" | "MAINTAIN";
  startScore: number | null;
  targetScore: number;
  successCriteria: string;
  priorityAtCreation: number;
  tasks: GeneratedTask[];
}

export interface GeneratedWeek {
  weekIndex: number;
  capacityMinutes: number;
  plannableMinutes: number;
  plannedMinutes: number;
  focusSkillIds: string[];
  objectives: GeneratedObjective[];
}

export interface GeneratedLearningPlan {
  plannerVersion: string;
  weeklyCapacityMinutes: number;
  adaptationBufferMinutes: number;
  weeks: GeneratedWeek[];
  warnings: string[];
  selectedSkillIds: string[];
  deferredSkillIds: string[];
}

function taskPattern(gap: PlannerGap): Array<Omit<GeneratedTask, "skillId" | "skillSlug" | "day" | "difficulty">> {
  if (gap.recommendedAction === "VALIDATE_FIRST" || gap.recommendedAction === "VALIDATE") {
    return [
      {
        type: "VALIDATE",
        title: "Validate " + gap.skillName + " baseline",
        durationMinutes: 30,
        flexible: false,
        rationaleCode: "LOW_CONFIDENCE_VALIDATE_FIRST",
        resourceTag: null
      },
      {
        type: "LEARN",
        title: "Targeted " + gap.skillName + " fundamentals",
        durationMinutes: 45,
        flexible: false,
        rationaleCode: "POST_VALIDATION_FOUNDATION",
        resourceTag: gap.skillSlug
      },
      {
        type: "PRACTICE",
        title: "Practice " + gap.skillName,
        durationMinutes: 45,
        flexible: false,
        rationaleCode: "APPLY_FOUNDATION",
        resourceTag: null
      }
    ];
  }

  return [
    {
      type: "LEARN",
      title: "Learn " + gap.skillName + " fundamentals",
      durationMinutes: 45,
      flexible: false,
      rationaleCode: "GAP_FOUNDATION",
      resourceTag: gap.skillSlug
    },
    {
      type: "PRACTICE",
      title: "Practice " + gap.skillName,
      durationMinutes: 45,
      flexible: false,
      rationaleCode: "PRACTICE_FOR_EVIDENCE",
      resourceTag: null
    },
    {
      type: "BUILD",
      title: "Build with " + gap.skillName,
      durationMinutes: 60,
      flexible: false,
      rationaleCode: "APPLY_IN_PROJECT",
      resourceTag: null
    },
    {
      type: "VALIDATE",
      title: "Validate " + gap.skillName,
      durationMinutes: 30,
      flexible: false,
      rationaleCode: "VERIFY_SKILLTWIN_ESTIMATE",
      resourceTag: null
    }
  ];
}

function difficulty(gap: PlannerGap): GeneratedTask["difficulty"] {
  if (gap.currentScore == null || gap.currentScore < 1.5) return "BASIC";
  if (gap.currentScore < 2.5) return "STANDARD";
  return "ADVANCED";
}

function objectiveType(gap: PlannerGap): GeneratedObjective["type"] {
  if (gap.recommendedAction === "VALIDATE_FIRST" || gap.recommendedAction === "VALIDATE") return "VALIDATE_FIRST";
  if (gap.recommendedAction === "MAINTAIN") return "MAINTAIN";
  return gap.currentScore == null || gap.currentScore < gap.targetScore ? "ACQUIRE" : "REINFORCE";
}

export function generateInitialLearningPlan(
  gaps: PlannerGap[],
  constraints: PlannerConstraints,
  maxWeeks = 4
): GeneratedLearningPlan {
  if (constraints.hoursPerWeek <= 0 || constraints.hoursPerWeek > 80) {
    throw new Error("INVALID_WEEKLY_CAPACITY");
  }
  if (!constraints.learningDays.length) throw new Error("NO_LEARNING_DAYS");

  const weeklyCapacityMinutes = Math.round(constraints.hoursPerWeek * 60);
  const adaptationBufferMinutes = Math.max(30, Math.round(weeklyCapacityMinutes * 0.10));
  const plannableMinutes = weeklyCapacityMinutes - adaptationBufferMinutes;

  const actionable = gaps
    .filter(gap => gap.priorityBand !== "COMPLETE" && gap.status !== "STRONG")
    .sort((a, b) =>
      a.learningStage - b.learningStage
      || b.priorityScore - a.priorityScore
      || a.skillSlug.localeCompare(b.skillSlug)
    );

  const weeks: GeneratedWeek[] = [];
  const selected = new Set<string>();
  let cursor = 0;

  for (let weekIndex = 1; weekIndex <= maxWeeks && cursor < actionable.length; weekIndex += 1) {
    const weekGaps = actionable.slice(cursor, cursor + 2);
    cursor += weekGaps.length;

    const objectives: GeneratedObjective[] = [];
    let plannedMinutes = 0;
    let dayCursor = 0;

    for (const gap of weekGaps) {
      const generatedTasks: GeneratedTask[] = [];
      for (const template of taskPattern(gap)) {
        if (plannedMinutes + template.durationMinutes > plannableMinutes) break;

        generatedTasks.push({
          ...template,
          skillId: gap.skillId,
          skillSlug: gap.skillSlug,
          day: constraints.learningDays[dayCursor % constraints.learningDays.length],
          difficulty: difficulty(gap)
        });
        dayCursor += 1;
        plannedMinutes += template.durationMinutes;
      }

      if (!generatedTasks.length) continue;
      selected.add(gap.skillId);
      objectives.push({
        skillId: gap.skillId,
        requirementId: gap.requirementId,
        type: objectiveType(gap),
        startScore: gap.currentScore,
        targetScore: gap.targetScore,
        successCriteria: "Demonstrate " + gap.skillName + " at target score " + gap.targetScore + " with stronger validation evidence.",
        priorityAtCreation: gap.priorityScore,
        tasks: generatedTasks
      });
    }

    if (objectives.length) {
      weeks.push({
        weekIndex,
        capacityMinutes: weeklyCapacityMinutes,
        plannableMinutes,
        plannedMinutes,
        focusSkillIds: objectives.map(objective => objective.skillId),
        objectives
      });
    }
  }

  const deferredSkillIds = actionable.filter(gap => !selected.has(gap.skillId)).map(gap => gap.skillId);
  const warnings: string[] = [];
  if (deferredSkillIds.length) warnings.push("PRIORITY_GAPS_DEFERRED_TO_LATER_WEEKS");
  if (!weeks.length) warnings.push("NO_ACTIONABLE_GAPS");

  return {
    plannerVersion: PLANNER_VERSION,
    weeklyCapacityMinutes,
    adaptationBufferMinutes,
    weeks,
    warnings,
    selectedSkillIds: [...selected],
    deferredSkillIds
  };
}
