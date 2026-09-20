export type EvidencePlanCandidate = {
  taskId: string;
  logicalTaskId: string;
  taskType: "LEARN" | "PRACTICE" | "BUILD" | "VALIDATE";
  difficulty: "BASIC" | "STANDARD" | "ADVANCED";
  flexible: boolean;
  durationMinutes: number;
  weekIndex: number;
  weekPlannedMinutes: number;
  gapStatus: "STRONG" | "DEVELOPING" | "GAP" | null;
  capabilityScore: number | null;
  targetScore: number | null;
};

export type EvidencePlanOperation =
  | {
      type: "REMOVE_TASK";
      logicalTaskId: string;
      taskId: string;
      durationMinutes: number;
      weekIndex: number;
      weekPlannedMinutes: number;
      reasonCode: "EVIDENCE_MADE_TASK_REDUNDANT";
    }
  | {
      type: "CHANGE_DIFFICULTY";
      logicalTaskId: string;
      taskId: string;
      from: "BASIC" | "STANDARD" | "ADVANCED";
      to: "BASIC" | "STANDARD" | "ADVANCED";
      weekIndex: number;
      weekPlannedMinutes: number;
      reasonCode: "EVIDENCE_SUPPORTS_HIGHER_DIFFICULTY";
    };

export function selectEvidencePlanOperation(
  candidates: EvidencePlanCandidate[]
): EvidencePlanOperation | null {
  const ordered = [...candidates].sort((left, right) => {
    const leftStrong = left.gapStatus === "STRONG" || (
      left.capabilityScore != null
      && left.targetScore != null
      && left.capabilityScore >= left.targetScore
    );
    const rightStrong = right.gapStatus === "STRONG" || (
      right.capabilityScore != null
      && right.targetScore != null
      && right.capabilityScore >= right.targetScore
    );
    if (leftStrong !== rightStrong) return leftStrong ? -1 : 1;
    if (left.weekIndex !== right.weekIndex) return left.weekIndex - right.weekIndex;
    return left.durationMinutes - right.durationMinutes;
  });

  const redundant = ordered.find(candidate =>
    candidate.flexible
    && (candidate.taskType === "LEARN" || candidate.taskType === "PRACTICE")
    && (
      candidate.gapStatus === "STRONG"
      || (
        candidate.capabilityScore != null
        && candidate.targetScore != null
        && candidate.capabilityScore >= candidate.targetScore
      )
    )
  );

  if (redundant) {
    return {
      type: "REMOVE_TASK",
      taskId: redundant.taskId,
      logicalTaskId: redundant.logicalTaskId,
      durationMinutes: redundant.durationMinutes,
      weekIndex: redundant.weekIndex,
      weekPlannedMinutes: redundant.weekPlannedMinutes,
      reasonCode: "EVIDENCE_MADE_TASK_REDUNDANT"
    };
  }

  const harder = ordered.find(candidate =>
    candidate.taskType === "PRACTICE"
    && candidate.difficulty === "BASIC"
    && candidate.capabilityScore != null
    && candidate.capabilityScore >= 1.5
    && candidate.gapStatus !== "GAP"
  );

  if (harder) {
    return {
      type: "CHANGE_DIFFICULTY",
      taskId: harder.taskId,
      logicalTaskId: harder.logicalTaskId,
      from: "BASIC",
      to: "STANDARD",
      weekIndex: harder.weekIndex,
      weekPlannedMinutes: harder.weekPlannedMinutes,
      reasonCode: "EVIDENCE_SUPPORTS_HIGHER_DIFFICULTY"
    };
  }

  return null;
}
