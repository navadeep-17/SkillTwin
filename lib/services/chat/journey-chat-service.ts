import "server-only";
import { getSql } from "@/lib/db/postgres";
import { classifyJourneyIntent, findMentionedSkill, type JourneyIntent } from "@/lib/domain/journey-intent";
import { buildTwinProofTrail } from "@/lib/domain/twin-challenge";
import { isMutatingJourneyIntent, type AgentReadIntent } from "@/lib/domain/agent-read-plan";
import { getAgentReadOrchestrator } from "@/lib/services/chat/agent-read-orchestrator";
import { firstChatTitle, hydrateChatMessages, pendingChatAction } from "@/lib/domain/agent-thread-history";

type Row = Record<string, unknown>;

function rows(value: unknown): Row[] {
  return value as Row[];
}

function parseJsonValue(value: unknown): unknown {
  let current = value;
  for (let depth = 0; depth < 2 && typeof current === "string"; depth += 1) {
    try {
      current = JSON.parse(current);
    } catch {
      break;
    }
  }
  return current;
}

function arrayOfStrings(value: unknown): string[] {
  const parsed = parseJsonValue(value);
  return Array.isArray(parsed) ? parsed.map(String) : [];
}

export interface JourneyReference {
  type: "skill" | "gap_snapshot" | "learning_plan" | "learning_task" | "plan_diff" | "assessment" | "profile_project";
  id: string;
  label: string;
}

export interface ChatActionProposal {
  id: string;
  actionType: "UNDO_PLAN_DIFF" | "START_ASSESSMENT" | "GENERATE_PLAN";
  label: string;
  payload: Record<string, unknown>;
  expiresAt: string;
}

function ref(type: JourneyReference["type"], row: Row, label: string): JourneyReference {
  return { type, id: String(row.id), label };
}

export class JourneyChatService {
  async send(input: { userId: string; message: string; threadId?: string | null; enhanced?: boolean }) {
    const startedAt=Date.now();
    const sql = getSql();
    const intent = classifyJourneyIntent(input.message);
    const threadId = await this.resolveThread(input.userId, input.threadId ?? null);

    const userMessageRows = rows(await sql.unsafe(
      "insert into public.journey_chat_messages(thread_id,user_id,role,content,intent) values ($1::uuid,$2::uuid,'USER',$3,$4) returning id,created_at",
      [threadId, input.userId, input.message, intent]
    ));
    const userMessageId = String(userMessageRows[0].id);
    await sql.unsafe(
      "update public.journey_chat_threads set title=$3 where id=$1::uuid and user_id=$2::uuid and title='SkillTwin journey'",
      [threadId,input.userId,firstChatTitle(input.message)]
    );

    const context = await this.context(input.userId, input.message);
    // Model selection only applies to read-only requests. Every mutation still
    // uses the existing confirmation-gated deterministic proposal workflow.
    let readRun: Awaited<ReturnType<ReturnType<typeof getAgentReadOrchestrator>["run"]>> | null = null;
    if (input.enhanced && !isMutatingJourneyIntent(intent)) {
      try {
        readRun = await getAgentReadOrchestrator().run({
          userId:input.userId,
          message:input.message,
          intent:intent as AgentReadIntent,
          context,
          readAssessmentProof:async ()=>{
            const proof=await this.explainAssessment(input.userId,context.mentionedSkill);
            return {content:proof.content,refs:proof.refs};
          }
        });
      } catch (error) {
        console.warn("journey.agent.read.fallback", {
          errorType:error instanceof Error ? error.name : "Unknown"
        });
      }
    }
    const generated = readRun ?? await this.answer(intent, input.message, context, input.userId);
    let actionProposal: ChatActionProposal | null = null;

    if (generated.action) {
      const proposalRows = rows(await sql.unsafe(
        "insert into public.chat_action_proposals(thread_id,user_id,source_message_id,action_type,payload,baseline_ref,status) values ($1::uuid,$2::uuid,$3::uuid,$4,$5::jsonb,$6::jsonb,'PROPOSED') returning *",
        [
          threadId,
          input.userId,
          userMessageId,
          generated.action.actionType,
          JSON.stringify(generated.action.payload),
          JSON.stringify(generated.action.baselineRef)
        ]
      ));
      const proposal = proposalRows[0];
      actionProposal = {
        id: String(proposal.id),
        actionType: String(proposal.action_type) as ChatActionProposal["actionType"],
        label: generated.action.label,
        payload: generated.action.payload,
        expiresAt: new Date(String(proposal.expires_at)).toISOString()
      };
    }

    const assistantRows = rows(await sql.unsafe(
      "insert into public.journey_chat_messages(thread_id,user_id,role,content,intent,entity_refs,evidence_refs,metadata) values ($1::uuid,$2::uuid,'ASSISTANT',$3,$4,$5::jsonb,$6::jsonb,$7::jsonb) returning id,created_at",
      [
        threadId,
        input.userId,
        generated.content,
        intent,
        JSON.stringify(generated.refs),
        JSON.stringify(generated.evidenceRefs),
        JSON.stringify({
          grounded: true,
          actionProposalId: actionProposal?.id ?? null,
          generator: readRun?.meta.generator ?? "deterministic-grounded-i1",
          readTools: readRun?.meta.readTools ?? [],
          durationMs: Date.now()-startedAt
        })
      ]
    ));

    await sql.unsafe(
      "update public.journey_chat_threads set updated_at=now() where id=$1::uuid and user_id=$2::uuid",
      [threadId, input.userId]
    );

    return {
      threadId,
      message: {
        id: String(assistantRows[0].id),
        role: "ASSISTANT",
        content: generated.content,
        intent,
        refs: generated.refs,
        evidenceRefs: generated.evidenceRefs,
        agentMode:readRun?.meta.generator ?? "deterministic-grounded-i1",
        readTools:readRun?.meta.readTools ?? [],
        createdAt: new Date(String(assistantRows[0].created_at)).toISOString()
      },
      actionProposal
    };
  }

  async getThread(userId: string, threadId: string) {
    const sql = getSql();
    const threadRows = rows(await sql.unsafe(
      "select * from public.journey_chat_threads where id=$1::uuid and user_id=$2::uuid limit 1",
      [threadId, userId]
    ));
    if (!threadRows[0]) throw new Error("CHAT_THREAD_NOT_FOUND");

    const messages = rows(await sql.unsafe(
      "select * from (select id,role,content,intent,entity_refs,evidence_refs,metadata,created_at from public.journey_chat_messages where thread_id=$1::uuid and user_id=$2::uuid order by created_at desc,id desc limit 80) recent order by created_at,id",
      [threadId, userId]
    ));

    const proposals = rows(await sql.unsafe(
      "select id,source_message_id,action_type,payload,baseline_ref,status,expires_at,executed_at,created_at from public.chat_action_proposals where thread_id=$1::uuid and user_id=$2::uuid order by created_at",
      [threadId, userId]
    ));

    return {
      thread: {
        id: String(threadRows[0].id),
        title: String(threadRows[0].title),
        updatedAt: new Date(String(threadRows[0].updated_at)).toISOString()
      },
      messages,
      hydratedMessages: hydrateChatMessages(messages),
      pendingAction: pendingChatAction(proposals,Date.now()),
      actionProposals: proposals
    };
  }

  async listThreads(userId: string) {
    const sql = getSql();
    const result = rows(await sql.unsafe(
      "select id,title,created_at,updated_at from public.journey_chat_threads where user_id=$1::uuid order by updated_at desc limit 20",
      [userId]
    ));
    return result.map(row => ({
      id: String(row.id),
      title: String(row.title),
      createdAt: new Date(String(row.created_at)).toISOString(),
      updatedAt: new Date(String(row.updated_at)).toISOString()
    }));
  }

  private async resolveThread(userId: string, requested: string | null) {
    const sql = getSql();

    if (requested) {
      const found = rows(await sql.unsafe(
        "select id from public.journey_chat_threads where id=$1::uuid and user_id=$2::uuid limit 1",
        [requested, userId]
      ));
      if (!found[0]) throw new Error("CHAT_THREAD_NOT_FOUND");
      return String(found[0].id);
    }

    const created = rows(await sql.unsafe(
      "insert into public.journey_chat_threads(user_id,title) values ($1::uuid,'SkillTwin journey') returning id",
      [userId]
    ));
    return String(created[0].id);
  }

  private async context(userId: string, message: string) {
    const sql = getSql();

    const [
      snapshotResult,
      gapResult,
      planResult,
      taskResult,
      diffResult,
      skillResult,
      assessmentResult
    ] = await Promise.all([
      sql.unsafe(
        "select gs.*,tr.name role_name,rv.version role_model_version from public.gap_snapshots gs join public.role_versions rv on rv.id=gs.role_version_id join public.target_roles tr on tr.id=rv.role_id join public.career_goals g on g.id=gs.goal_id where gs.user_id=$1::uuid and g.user_id=$1::uuid and g.status='ACTIVE' order by gs.created_at desc limit 1",
        [userId]
      ),
      sql.unsafe(
        "select sgr.*,s.canonical_name,s.slug,(select count(*) from public.assessment_question_bank qb where qb.skill_id=sgr.skill_id and qb.is_active=true and qb.type in ('MCQ','SHORT_TEXT','SCENARIO'))::int question_count from public.skill_gap_results sgr join public.skills s on s.id=sgr.skill_id where sgr.snapshot_id=(select gs.id from public.gap_snapshots gs join public.career_goals g on g.id=gs.goal_id where gs.user_id=$1::uuid and g.user_id=$1::uuid and g.status='ACTIVE' order by gs.created_at desc limit 1) order by sgr.priority_score desc limit 12",
        [userId]
      ),
      sql.unsafe(
        "select * from public.learning_plans where user_id=$1::uuid and status='ACTIVE' order by version desc limit 1",
        [userId]
      ),
      sql.unsafe(
        "select t.*,s.canonical_name from public.learning_tasks t join public.learning_plans p on p.id=t.plan_id join public.skills s on s.id=t.skill_id where p.user_id=$1::uuid and p.status='ACTIVE' and t.status in ('PLANNED','IN_PROGRESS') order by t.due_at nulls last,t.created_at limit 5",
        [userId]
      ),
      sql.unsafe(
        "select * from public.plan_diffs where user_id=$1::uuid and status in ('APPLIED','UNDONE') order by created_at desc limit 1",
        [userId]
      ),
      sql.unsafe(
        "select us.*,s.canonical_name,s.slug from public.user_skills us join public.skills s on s.id=us.skill_id where us.user_id=$1::uuid order by s.canonical_name",
        [userId]
      ),
      sql.unsafe(
        "select o.*,s.canonical_name from public.skill_assessment_outcomes o join public.skills s on s.id=o.skill_id where o.user_id=$1::uuid order by o.created_at desc limit 1",
        [userId]
      )
    ]);

    const skills = rows(skillResult);
    const mentionedSkill = findMentionedSkill(message, skills);

    return {
      snapshot: rows(snapshotResult)[0] ?? null,
      gaps: rows(gapResult),
      plan: rows(planResult)[0] ?? null,
      tasks: rows(taskResult),
      latestDiff: rows(diffResult)[0] ?? null,
      skills,
      mentionedSkill,
      latestAssessment: rows(assessmentResult)[0] ?? null
    };
  }

  /**
   * Read-only, assessment-ID-linked agent tool.
   * Never infer a PlanDiff from recency or manufacture an explanation.
   * All three evidence lookups are scoped to this signed-in learner.
   */
  private async explainAssessment(userId: string, mentionedSkill: Row | null) {
    const sql = getSql();
    const skillId = mentionedSkill?.skill_id == null ? null : String(mentionedSkill.skill_id);
    const outcomeRows = rows(await sql.unsafe(
      "select o.assessment_id,o.skill_id,o.normalized_score,o.coverage,o.created_at,s.canonical_name from public.skill_assessment_outcomes o join public.skills s on s.id=o.skill_id where o.user_id=$1::uuid and ($2::uuid is null or o.skill_id=$2::uuid) order by o.created_at desc limit 1",
      [userId, skillId]
    ));
    const outcome = outcomeRows[0];
    const skillName = mentionedSkill?.canonical_name == null ? "this skill" : String(mentionedSkill.canonical_name);
    if (!outcome) {
      return {
        content: "I cannot verify a completed assessment for " + skillName +
          " yet. I won't guess why your score or roadmap did or didn't change. Complete a challenge, then ask me to explain its recorded result.",
        refs: [] as JourneyReference[],
        evidenceRefs: [] as string[],
        action: null
      };
    }

    const assessmentId = String(outcome.assessment_id);
    const assessedSkillId = String(outcome.skill_id);
    const [historyResults, decisionResults, diffResults] = await Promise.all([
      sql.unsafe(
        "select skill_id,trigger_ref,before_state,after_state,explanation from public.skill_history where user_id=$1::uuid and skill_id=$2::uuid and trigger_type='ASSESSMENT_COMPLETED' and trigger_ref=$3 order by created_at desc limit 1",
        [userId, assessedSkillId, assessmentId]
      ),
      sql.unsafe(
        "select trigger_ref,decision,reason_code,reason from public.replan_decisions where user_id=$1::uuid and trigger_type='ASSESSMENT_COMPLETED' and trigger_ref=$2 order by created_at desc limit 1",
        [userId, assessmentId]
      ),
      sql.unsafe(
        "select id,trigger_refs,status,summary from public.plan_diffs where user_id=$1::uuid and status='APPLIED' order by created_at desc limit 100",
        [userId]
      )
    ]);
    const history = rows(historyResults).map(row => ({
      skill_id: String(row.skill_id),
      trigger_ref: String(row.trigger_ref),
      before_state: row.before_state,
      after_state: row.after_state,
      explanation: row.explanation == null ? null : String(row.explanation)
    }));
    const decisions = rows(decisionResults).map(row => ({
      trigger_ref: String(row.trigger_ref),
      decision: String(row.decision),
      reason_code: row.reason_code == null ? null : String(row.reason_code),
      reason: row.reason == null ? null : String(row.reason)
    }));
    const diffs = rows(diffResults).map(row => ({
      id: String(row.id),
      trigger_refs: row.trigger_refs,
      status: String(row.status),
      summary: row.summary == null ? null : String(row.summary)
    }));
    const proof = buildTwinProofTrail({
      assessment_id: assessmentId,
      skill_id: assessedSkillId,
      normalized_score: outcome.normalized_score == null ? null : Number(outcome.normalized_score),
      coverage: outcome.coverage == null ? null : Number(outcome.coverage),
      created_at: String(outcome.created_at)
    },history,decisions,diffs);
    if (!proof) throw new Error("ASSESSMENT_PROOF_NOT_FOUND");

    const formatState = (state: typeof proof.before) => state
      ? (state.level ?? "Unknown") +
        (state.capability == null ? "" : " (capability " + state.capability.toFixed(2) + ")") +
        (state.confidencePercent == null ? "" : ", confidence " + state.confidencePercent + "%")
      : "not confirmed by a matching history record";

    const parts = [
      "Your latest recorded " + String(outcome.canonical_name) + " assessment scored " +
        (proof.scorePercent == null ? "an unavailable score" : proof.scorePercent + "%") +
        " with " + (proof.coveragePercent == null ? "unavailable" : proof.coveragePercent + "%") + " concept coverage.",
      "Before: " + formatState(proof.before) + ".",
      "After: " + formatState(proof.after) + "."
    ];
    if (proof.skillExplanation) parts.push("Recorded explanation: " + proof.skillExplanation);
    parts.push(
      proof.planStatus === "CHANGED" ? "Roadmap: an assessment-linked change was applied. " + proof.planReason
        : proof.planStatus === "UNCHANGED" ? "Roadmap: no change was needed. " + proof.planReason
          : "Roadmap: no decision for this assessment is confirmed. " + proof.planReason
    );
    parts.push("The skill estimate and confidence are guidance, not a certification or hiring probability.");

    const refs: JourneyReference[] = [
      {type:"assessment",id:assessmentId,label:"Completed " + String(outcome.canonical_name) + " assessment"},
      {type:"skill",id:assessedSkillId,label:String(outcome.canonical_name)}
    ];
    if (proof.planDiffId) {
      refs.push({type:"plan_diff",id:proof.planDiffId,label:"Applied assessment-linked roadmap change"});
    }
    return {content:parts.join(" "),refs,evidenceRefs:[] as string[],action:null};
  }

  private async answer(
    intent: JourneyIntent,
    message: string,
    context: {
      snapshot: Row | null;
      gaps: Row[];
      plan: Row | null;
      tasks: Row[];
      latestDiff: Row | null;
      skills: Row[];
      mentionedSkill: Row | null;
      latestAssessment: Row | null;
    },
    userId: string
  ) {
    if (intent === "EXPLAIN_ASSESSMENT") {
      return this.explainAssessment(userId, context.mentionedSkill);
    }

    const refs: JourneyReference[] = [];
    const evidenceRefs: string[] = [];

    if (intent === "UNDO_ROADMAP_CHANGE") {
      const diff = context.latestDiff;
      if (!diff || String(diff.status) !== "APPLIED" || !Boolean(diff.can_undo)) {
        return {
          content: "There is no currently undoable applied roadmap change. I have not changed your plan.",
          refs,
          evidenceRefs,
          action: null
        };
      }

      refs.push(ref("plan_diff", diff, "Latest roadmap change"));
      return {
        content: "I can propose undoing the latest applied roadmap change. This will not delete history; after confirmation, SkillTwin will validate the current plan and create a new rollback version only if the affected task is still safe to undo.",
        refs,
        evidenceRefs: arrayOfStrings(diff.evidence_refs),
        action: {
          actionType: "UNDO_PLAN_DIFF" as const,
          label: "Confirm safe undo",
          payload: { diffId: String(diff.id) },
          baselineRef: {
            diffId: String(diff.id),
            toPlanId: diff.to_plan_id == null ? null : String(diff.to_plan_id),
            toVersion: diff.to_version == null ? null : Number(diff.to_version)
          }
        }
      };
    }

    if (intent === "START_ASSESSMENT") {
      const assessable = context.gaps.find(gap => Number(gap.question_count ?? 0) >= 4);
      if (!assessable) {
        return {
          content: "None of your current priority gaps has a sufficiently validated challenge bank yet. I have not started a low-quality assessment.",
          refs,
          evidenceRefs,
          action: null
        };
      }

      refs.push({
        type: "skill",
        id: String(assessable.skill_id),
        label: String(assessable.canonical_name)
      });

      return {
        content: "I can start a short validation challenge for " + String(assessable.canonical_name) + ". I will only update SkillTwin after the full challenge is completed and accepted as assessment evidence.",
        refs,
        evidenceRefs,
        action: {
          actionType: "START_ASSESSMENT" as const,
          label: "Start challenge",
          payload: { targetSkillId: String(assessable.skill_id) },
          baselineRef: {
            gapSnapshotId: context.snapshot?.id == null ? null : String(context.snapshot.id)
          }
        }
      };
    }

    if (intent === "GENERATE_PLAN") {
      if (context.plan) {
        refs.push(ref("learning_plan", context.plan, "Active roadmap"));
        return {
          content: "You already have an active Plan v" + String(context.plan.version) + ". I will not silently regenerate it from chat. Ordinary learner-state changes go through the adaptive replanner.",
          refs,
          evidenceRefs,
          action: null
        };
      }

      if (!context.snapshot) {
        return {
          content: "I cannot generate a grounded roadmap yet because there is no current gap snapshot. Analyze your profile first.",
          refs,
          evidenceRefs,
          action: null
        };
      }

      refs.push(ref("gap_snapshot", context.snapshot, "Current gap snapshot"));
      return {
        content: "Your gap analysis is ready, so I can propose generating the initial roadmap. This is an explicit action and will only run after confirmation.",
        refs,
        evidenceRefs,
        action: {
          actionType: "GENERATE_PLAN" as const,
          label: "Generate Plan v1",
          payload: {},
          baselineRef: { gapSnapshotId: String(context.snapshot.id) }
        }
      };
    }

    if (intent === "WHY_ROADMAP_CHANGED") {
      const diff = context.latestDiff;
      if (!diff) {
        return {
          content: "I do not have a committed roadmap change to explain yet.",
          refs,
          evidenceRefs,
          action: null
        };
      }

      refs.push(ref("plan_diff", diff, "Roadmap change"));
      if (diff.from_plan_id) refs.push({ type: "learning_plan", id: String(diff.from_plan_id), label: "Previous plan" });
      if (diff.to_plan_id) refs.push({ type: "learning_plan", id: String(diff.to_plan_id), label: "Updated plan" });
      evidenceRefs.push(...arrayOfStrings(diff.evidence_refs));

      const parsedOperations = parseJsonValue(diff.operations);
      const operations = Array.isArray(parsedOperations) ? parsedOperations as Array<Record<string, unknown>> : [];
      const operationSummary = operations.map(operation => {
        const task = operation.task && typeof operation.task === "object"
          ? operation.task as Record<string, unknown>
          : {};
        return String(operation.type) + (task.title ? ": " + String(task.title) : "");
      });

      return {
        content: String(diff.summary) + " " + String(diff.reason)
          + (operationSummary.length ? " Applied: " + operationSummary.join("; ") + "." : ""),
        refs,
        evidenceRefs,
        action: null
      };
    }

    if (intent === "WHAT_NEXT") {
      if (!context.plan || !context.tasks.length) {
        return {
          content: "There is no active upcoming task I can ground a next-step recommendation in yet.",
          refs,
          evidenceRefs,
          action: null
        };
      }

      refs.push(ref("learning_plan", context.plan, "Active roadmap"));
      const top = context.tasks.slice(0, 3);
      for (const task of top) refs.push(ref("learning_task", task, String(task.title)));

      const taskText = top.map((task, index) =>
        (index + 1) + ". " + String(task.title) + " (" + String(task.duration_minutes) + " min)"
      ).join(" ");

      return {
        content: "Your next roadmap work is: " + taskText + " I am reading this from your active Plan v" + String(context.plan.version) + ", not creating a new schedule in chat.",
        refs,
        evidenceRefs,
        action: null
      };
    }

    if (intent === "READINESS") {
      if (!context.snapshot) {
        return {
          content: "There is no current readiness snapshot yet. Readiness is computed only after SkillTwin evidence is compared with a target-role model.",
          refs,
          evidenceRefs,
          action: null
        };
      }

      const roleName = String(context.snapshot.role_name ?? "target role");
      refs.push(ref("gap_snapshot", context.snapshot, "Current " + roleName + " gap snapshot"));
      return {
        content: "Your current " + roleName + " readiness guidance metric is " + String(context.snapshot.readiness)
          + "%, with " + String(context.snapshot.evidence_coverage)
          + "% evidence coverage. Readiness is a role-weighted learning guidance metric, not a hiring probability.",
        refs,
        evidenceRefs,
        action: null
      };
    }

    if (intent === "SKILL_STATUS") {
      const skill = context.mentionedSkill;
      if (!skill) {
        const topGap = context.gaps[0];
        if (!topGap) {
          return {
            content: "Name a skill from your SkillTwin and I can explain its current capability, confidence, and target-role gap.",
            refs,
            evidenceRefs,
            action: null
          };
        }

        refs.push({
          type: "skill",
          id: String(topGap.skill_id),
          label: String(topGap.canonical_name)
        });
        return {
          content: "Your current highest-priority gap is " + String(topGap.canonical_name)
            + ". Its priority band is " + String(topGap.priority_band)
            + " and SkillTwin currently recommends " + String(topGap.recommended_action) + ".",
          refs,
          evidenceRefs,
          action: null
        };
      }

      refs.push(ref("skill", skill, String(skill.canonical_name)));
      const gap = context.gaps.find(row => String(row.skill_id) === String(skill.skill_id));
      if (gap && context.snapshot) refs.push(ref("gap_snapshot", context.snapshot, "Current role-gap snapshot"));

      const scoreText = skill.capability_score == null
        ? "capability is still UNKNOWN"
        : "capability is " + String(skill.level_value) + " (score " + Number(skill.capability_score).toFixed(2) + ")";
      const confidence = Math.round(Number(skill.confidence ?? 0) * 100);

      return {
        content: String(skill.canonical_name) + ": " + scoreText + " with " + confidence
          + "% confidence."
          + (gap ? " Against " + String(context.snapshot?.role_name ?? "your target role") + " v"
            + String(context.snapshot?.role_model_version ?? "current") + ", the current gap severity is "
            + Math.round(Number(gap.gap_severity) * 100) + "% and the recommended action is "
            + String(gap.recommended_action) + "." : ""),
        refs,
        evidenceRefs,
        action: null
      };
    }

    const pieces: string[] = [];
    if (context.snapshot) {
      refs.push(ref("gap_snapshot", context.snapshot, "Current gap snapshot"));
      pieces.push(String(context.snapshot.role_name ?? "Target-role") + " readiness is " + String(context.snapshot.readiness) + "%.");
    }
    if (context.gaps[0]) {
      const gap = context.gaps[0];
      refs.push({ type: "skill", id: String(gap.skill_id), label: String(gap.canonical_name) });
      pieces.push("The highest-priority current gap is " + String(gap.canonical_name) + ".");
    }
    if (context.tasks[0]) {
      const task = context.tasks[0];
      refs.push(ref("learning_task", task, String(task.title)));
      pieces.push("Your next planned task is " + String(task.title) + ".");
    }
    if (!pieces.length) pieces.push("Your SkillTwin does not have enough persisted learner state yet. Start with profile analysis.");

    return {
      content: pieces.join(" "),
      refs,
      evidenceRefs,
      action: null
    };
  }
}

let service: JourneyChatService | null = null;

export function getJourneyChatService() {
  if (!service) service = new JourneyChatService();
  return service;
}
