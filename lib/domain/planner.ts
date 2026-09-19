import type { GapRow } from "./role-gap.js";
export type TaskType = "LEARN" | "PRACTICE" | "BUILD" | "VALIDATE";
export interface LearningTask { id: string; skillId: string; title: string; type: TaskType; minutes: number; day: string; status: "PLANNED" | "COMPLETED" }
export interface LearningPlan { version: number; weeklyCapacity: number; adaptationBuffer: number; tasks: LearningTask[] }

export function createWeekOnePlan(gaps: GapRow[], weeklyMinutes = 600): LearningPlan {
  const adaptationBuffer = Math.max(45, Math.round(weeklyMinutes * 0.10));
  const maxPlannable = weeklyMinutes - adaptationBuffer;
  const selected = gaps.filter(g => g.priority !== "COMPLETE").slice(0, 2);
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const candidates: LearningTask[] = [];
  let dayIndex = 0;
  for (const gap of selected) {
    const pattern: Array<[TaskType, number, string]> = gap.recommendedAction.startsWith("VALIDATE")
      ? [["VALIDATE", 30, `Validate ${gap.skillId}`], ["LEARN", 45, `Targeted ${gap.skillId} lesson`], ["PRACTICE", 45, `Practice ${gap.skillId}`]]
      : [["LEARN", 45, `Learn ${gap.skillId}`], ["PRACTICE", 45, `Practice ${gap.skillId}`], ["BUILD", 60, `Build with ${gap.skillId}`], ["VALIDATE", 30, `Validate ${gap.skillId}`]];
    for (const [type, minutes, title] of pattern) candidates.push({ id: `task-${gap.skillId}-${type.toLowerCase()}-${candidates.length + 1}`, skillId: gap.skillId, title, type, minutes, day: days[dayIndex++ % days.length], status: "PLANNED" });
  }
  let used = 0;
  const tasks = candidates.filter(task => { if (used + task.minutes > maxPlannable) return false; used += task.minutes; return true; });
  return { version: 1, weeklyCapacity: weeklyMinutes, adaptationBuffer, tasks };
}
