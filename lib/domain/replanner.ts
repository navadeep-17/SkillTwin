import type { LearningPlan, LearningTask } from "./planner.js";
export type PlanOperation = { type: "ADD_TASK"; task: LearningTask; reason: string } | { type: "MOVE_TASK"; taskId: string; fromDay: string; toDay: string; reason: string };
export interface PlanDiff { fromVersion: number; toVersion: number; operations: PlanOperation[]; reason: string }
export function replanForRestWeakness(plan: LearningPlan, weaknesses: string[]): { plan: LearningPlan; diff: PlanDiff } {
  const reinforcement: LearningTask = { id: `task-rest-api-reinforcement-v${plan.version + 1}`, skillId: "rest-api", title: "HTTP update semantics reinforcement", type: "PRACTICE", minutes: 25, day: "Thu", status: "PLANNED" };
  const operations: PlanOperation[] = [{ type: "ADD_TASK", task: reinforcement, reason: `Assessment weakness: ${weaknesses.join(", ")}` }];
  const plannedMinutes = plan.tasks.reduce((sum, t) => sum + t.minutes, 0);
  if (plannedMinutes + reinforcement.minutes > plan.weeklyCapacity) throw new Error("Replan exceeds weekly capacity");
  const next = { ...plan, version: plan.version + 1, tasks: [...plan.tasks, reinforcement] };
  return { plan: next, diff: { fromVersion: plan.version, toVersion: next.version, operations, reason: "REST assessment identified targeted HTTP semantics weakness" } };
}
