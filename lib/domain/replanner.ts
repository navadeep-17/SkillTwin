import type { LearningPlan, LearningTask } from "./planner.js";

export type PlanOperation =
  | { type: "ADD_TASK"; task: LearningTask; reason: string }
  | { type: "MOVE_TASK"; taskId: string; fromDay: string; toDay: string; reason: string }
  | { type: "REMOVE_TASK"; taskId: string; reason: string }
  | { type: "CHANGE_DIFFICULTY"; taskId: string; from: "BASIC" | "STANDARD" | "ADVANCED"; to: "BASIC" | "STANDARD" | "ADVANCED"; reason: string }
  | { type: "CHANGE_DURATION"; taskId: string; fromMinutes: number; toMinutes: number; reason: string }
  | { type: "CHANGE_RESOURCE"; taskId: string; fromResourceId: string | null; toResourceId: string; reason: string };

export interface PlanDiff {
  fromVersion: number;
  toVersion: number;
  operations: PlanOperation[];
  reason: string;
}

export const SUPPORTED_PLAN_OPERATIONS: PlanOperation["type"][] = [
  "ADD_TASK",
  "MOVE_TASK",
  "REMOVE_TASK",
  "CHANGE_DIFFICULTY",
  "CHANGE_DURATION",
  "CHANGE_RESOURCE"
];

export function validatePlanOperations(operations: PlanOperation[]) {
  if (!operations.length) throw new Error("PlanDiff must contain at least one operation");

  for (const operation of operations) {
    if (!SUPPORTED_PLAN_OPERATIONS.includes(operation.type)) {
      throw new Error("Unsupported PlanDiff operation");
    }
    if (operation.type === "CHANGE_DURATION" && operation.toMinutes <= 0) {
      throw new Error("Task duration must remain positive");
    }
    if (operation.type === "CHANGE_RESOURCE" && !operation.toResourceId) {
      throw new Error("Replacement resource is required");
    }
  }

  return true;
}

export function replanForRestWeakness(plan: LearningPlan, weaknesses: string[]): { plan: LearningPlan; diff: PlanDiff } {
  const reinforcement: LearningTask = {
    id: `task-rest-api-reinforcement-v${plan.version + 1}`,
    skillId: "rest-api",
    title: "HTTP update semantics reinforcement",
    type: "PRACTICE",
    minutes: 25,
    day: "Thu",
    status: "PLANNED"
  };

  const operations: PlanOperation[] = [{
    type: "ADD_TASK",
    task: reinforcement,
    reason: `Assessment weakness: ${weaknesses.join(", ")}`
  }];

  validatePlanOperations(operations);

  const plannedMinutes = plan.tasks.reduce((sum, task) => sum + task.minutes, 0);
  if (plannedMinutes + reinforcement.minutes > plan.weeklyCapacity) {
    throw new Error("Replan exceeds weekly capacity");
  }

  const next = {
    ...plan,
    version: plan.version + 1,
    tasks: [...plan.tasks, reinforcement]
  };

  return {
    plan: next,
    diff: {
      fromVersion: plan.version,
      toVersion: next.version,
      operations,
      reason: "REST assessment identified targeted HTTP semantics weakness"
    }
  };
}
