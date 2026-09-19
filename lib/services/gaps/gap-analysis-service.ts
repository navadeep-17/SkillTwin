import "server-only";
import { analyzeRoleGaps } from "@/lib/domain/gap-engine";
import { PostgresGapRepository } from "@/lib/repositories/postgres/gap-repository";

function remainingWeeks(targetDate: string | null) {
  if (!targetDate) return undefined;
  const ms = new Date(`${targetDate}T23:59:59Z`).getTime() - Date.now();
  return Math.max(1, Math.ceil(ms / (7 * 24 * 60 * 60 * 1000)));
}

export class GapAnalysisService {
  constructor(private readonly repository = new PostgresGapRepository()) {}

  async recompute(userId: string, trigger: {type:string;ref:string}) {
    const goal = await this.repository.getOrCreateDefaultGoal(userId);
    const [role, userSkills] = await Promise.all([
      this.repository.loadRoleVersion(goal.roleVersionId),
      this.repository.listUserSkills(userId)
    ]);
    const analysis = analyzeRoleGaps({
      role,
      userSkills,
      preferredAlternatives: goal.preferredAlternatives,
      remainingWeeks: remainingWeeks(goal.targetDate)
    });
    const snapshotId = await this.repository.persistSnapshot(userId, goal, analysis, trigger);
    return { snapshotId, goal, role:{id:role.roleId,name:role.roleName,version:role.version}, ...analysis };
  }

  latest(userId: string) {
    return this.repository.latest(userId);
  }
}

let service: GapAnalysisService | null = null;
export function getGapAnalysisService() {
  if (!service) service = new GapAnalysisService();
  return service;
}
