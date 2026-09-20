import "server-only";
import { getSql } from "@/lib/db/postgres";

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

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").replace(/\s+/g, " ").trim();
}

export type JourneyIntent =
  | "WHY_ROADMAP_CHANGED"
  | "WHAT_NEXT"
  | "READINESS"
  | "SKILL_STATUS"
  | "UNDO_ROADMAP_CHANGE"
  | "START_ASSESSMENT"
  | "GENERATE_PLAN"
  | "JOURNEY_SUMMARY";

export interface JourneyReference {
  type: "skill" | "gap_snapshot" | "learning_plan" | "learning_task" | "plan_diff" | "assessment";
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

function classify(message: string): JourneyIntent {
  const text = normalize(message);
  if (/\b(undo|revert|roll back|rollback)\b/.test(text)) return "UNDO_ROADMAP_CHANGE";
  if (/\b(challenge me|test me|quiz me|assess me|validate me)\b/.test(text)) return "START_ASSESSMENT";
  if (/\b(generate|create|build)\b.*\b(plan|roadmap)\b/.test(text)) return "GENERATE_PLAN";
  if (/\bwhy\b.*\b(roadmap|plan)\b.*\b(change|changed|update|updated)\b/.test(text)
    || /\bwhy did.*change\b/.test(text)) return "WHY_ROADMAP_CHANGED";
  if (/\b(what next|next task|do next|learn next|today|this week)\b/.test(text)) return "WHAT_NEXT";
  if (/\b(readiness|ready for|how ready)\b/.test(text)) return "READINESS";
  if (/\b(skill|confidence|capability|level|gap)\b/.test(text)) return "SKILL_STATUS";
  return "JOURNEY_SUMMARY";
}

function ref(type: JourneyReference["type"], row: Row, label: string): JourneyReference {
  return { type, id: String(row.id), label };
}

export class JourneyChatService {
  async send(input: { userId: string; message: string; threadId?: string | null }) {
    const sql = getSql();
    const intent = classify(input.message);
    const threadId = await this.resolveThread(input.userId, input.threadId ?? null);

    const userMessageRows = rows(await sql.unsafe(
      "insert into public.journey_chat_messages(thread_id,user_id,role,content,intent) values ($1::uuid,$2::uuid,'USER',$3,$4) returning id,created_at",
      [threadId, input.userId, input.message, intent]
    ));
    const userMessageId = String(userMessageRows[0].id);

    const context = await this.context(input.userId, input.message);
    const generated = await this.answer(intent, input.message, context);
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
          generator: "deterministic-grounded-i1"
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
      "select id,role,content,intent,entity_refs,evidence_refs,metadata,created_at from public.journey_chat_messages where thread_id=$1::uuid and user_id=$2::uuid order by created_at,id",
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
        "select gs.*,tr.name role_name,rv.version role_model_version from public.gap_snapshots gs join public.role_versions rv on rv.id=gs.role_version_id join public.target_roles tr on tr.id=rv.role_id where gs.user_id=$1::uuid order by gs.created_at desc limit 1",
        [userId]
      ),
      sql.unsafe(
        "select sgr.*,s.canonical_name,s.slug,(select count(*) from public.assessment_question_bank qb where qb.skill_id=sgr.skill_id and qb.is_active=true and qb.type in ('MCQ','SHORT_TEXT','SCENARIO'))::int question_count from public.skill_gap_results sgr join public.skills s on s.id=sgr.skill_id where sgr.snapshot_id=(select id from public.gap_snapshots where user_id=$1::uuid order by created_at desc limit 1) order by sgr.priority_score desc limit 12",
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
    const normalizedMessage = normalize(message);
    const mentionedSkill = skills.find(skill => {
      const name = normalize(String(skill.canonical_name));
      const slug = normalize(String(skill.slug));
      return (name && normalizedMessage.includes(name)) || (slug && normalizedMessage.includes(slug));
    }) ?? null;

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
    }
  ) {
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
