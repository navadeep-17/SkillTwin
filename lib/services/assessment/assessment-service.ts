import "server-only";
import { createHash } from "node:crypto";
import { getSql } from "@/lib/db/postgres";
import { getEvidenceEngine } from "@/lib/services/skills/evidence-service";
import { getGapAnalysisService } from "@/lib/services/gaps/gap-analysis-service";
import { getAdaptiveReplannerService } from "@/lib/services/replanner/adaptive-replanner-service";

export const ASSESSMENT_BLUEPRINT_VERSION = "assessment-blueprint-e1";
export const ASSESSMENT_EVALUATION_VERSION = "deterministic-evaluator-e1";
export const ASSESSMENT_AGGREGATOR_VERSION = "assessment-aggregator-e1";
export const ASSESSMENT_QUESTION_VERSION = "rest-bank-e1";

type Row = Record<string, unknown>;

function rows(value: unknown): Row[] {
  return value as Row[];
}

function jsonArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function publicQuestion(row: Row) {
  return {
    id: String(row.id),
    ordinal: Number(row.ordinal),
    type: String(row.type),
    conceptIds: jsonArray(row.concept_ids),
    difficulty: Number(row.difficulty),
    prompt: String(row.prompt),
    options: Array.isArray(row.options) ? row.options : []
  };
}

function blueprint(skillId: string, concepts: string[], startDifficulty: number) {
  return {
    skillId,
    conceptTargets: concepts.map(conceptId => ({
      conceptId,
      weight: 1 / Math.max(concepts.length, 1),
      minObservations: 1
    })),
    difficultyMin: 1,
    difficultyMax: 4,
    startDifficulty,
    allowedTypes: ["MCQ", "SHORT_TEXT", "SCENARIO"],
    minItems: 4,
    maxItems: Math.min(6, Math.max(4, concepts.length)),
    targetCoverage: 0.80,
    stopConfidence: 0.78,
    blueprintVersion: ASSESSMENT_BLUEPRINT_VERSION
  };
}

function evaluateMcq(question: Row, optionId: string) {
  const key = jsonObject(question.answer_key);
  const rubric = jsonObject(question.rubric);
  const correct = String(key.correctOptionId ?? "");
  const score = optionId === correct ? 1 : 0;
  const feedback = score
    ? String(rubric.correctFeedback ?? "Correct.")
    : String(rubric.incorrectFeedback ?? "Review this concept and try a related question.");

  return {
    score,
    evaluatorConfidence: 1,
    feedback,
    errorTag: score ? null : jsonArray(question.concept_ids)[0] ?? "concept_gap"
  };
}

export interface ChallengeCreateInput {
  userId: string;
  targetSkillId?: string;
  sourceTaskId?: string;
  mode?: "CHALLENGE_ME" | "SCHEDULED_VALIDATION" | "CALIBRATION" | "CONFLICT_RESOLUTION";
}

export interface SubmitAnswerInput {
  userId: string;
  assessmentId: string;
  questionId: string;
  optionId: string;
  idempotencyKey?: string;
}

export class AssessmentService {
  async create(input: ChallengeCreateInput) {
    const sql = getSql();

    let targetSkillId = input.targetSkillId ?? null;
    let sourceTaskId = input.sourceTaskId ?? null;

    if (sourceTaskId) {
      const taskRows = rows(await sql.unsafe(
        "select t.skill_id from public.learning_tasks t join public.learning_plans p on p.id=t.plan_id where t.id=$1::uuid and p.user_id=$2::uuid limit 1",
        [sourceTaskId, input.userId]
      ));
      if (!taskRows[0]) throw new Error("SOURCE_TASK_NOT_FOUND");
      targetSkillId = String(taskRows[0].skill_id);
    }

    if (!targetSkillId) {
      const candidateRows = rows(await sql.unsafe(
        "select sgr.skill_id,sgr.priority_score,sgr.current_confidence from public.skill_gap_results sgr join public.gap_snapshots gs on gs.id=sgr.snapshot_id where gs.user_id=$1::uuid and gs.id=(select id from public.gap_snapshots where user_id=$1::uuid order by created_at desc limit 1) and exists(select 1 from public.assessment_question_bank qb where qb.skill_id=sgr.skill_id and qb.is_active=true) order by (sgr.priority_score * (1.25 - sgr.current_confidence)) desc limit 1",
        [input.userId]
      ));
      if (!candidateRows[0]) throw new Error("NO_ASSESSABLE_SKILL");
      targetSkillId = String(candidateRows[0].skill_id);
    }

    const [skillRows, stateRows, bankRows] = await Promise.all([
      sql.unsafe("select id,slug,canonical_name from public.skills where id=$1::uuid and is_active=true limit 1", [targetSkillId]),
      sql.unsafe("select capability_score,confidence,last_validated_at from public.user_skills where user_id=$1::uuid and skill_id=$2::uuid limit 1", [input.userId, targetSkillId]),
      sql.unsafe("select * from public.assessment_question_bank where skill_id=$1::uuid and is_active=true order by difficulty,id", [targetSkillId])
    ]);

    const skill = rows(skillRows)[0];
    const state = rows(stateRows)[0];
    const bank = rows(bankRows);
    if (!skill) throw new Error("SKILL_NOT_FOUND");
    if (bank.length < 4) throw new Error("QUESTION_BANK_TOO_SMALL");

    const currentScore = state?.capability_score == null ? null : Number(state.capability_score);
    const startDifficulty = currentScore == null || currentScore < 1.5 ? 1 : currentScore < 2.5 ? 2 : 3;

    const concepts = [...new Set(bank.map(row => String(row.concept_id)))];
    const frozenBlueprint = blueprint(targetSkillId, concepts, startDifficulty);
    const maxItems = Number(frozenBlueprint.maxItems);
    const selected = bank.slice(0, maxItems);

    const requestHash = createHash("sha256")
      .update(JSON.stringify({
        userId: input.userId,
        targetSkillId,
        sourceTaskId,
        mode: input.mode ?? "CHALLENGE_ME",
        blueprintVersion: ASSESSMENT_BLUEPRINT_VERSION,
        questionVersion: ASSESSMENT_QUESTION_VERSION
      }))
      .digest("hex");

    const assessmentRows = rows(await sql.unsafe(
      "insert into public.skill_assessments(user_id,skill_id,mode,status,blueprint_json,blueprint_version,source_task_id,current_question_index) values ($1::uuid,$2::uuid,$3,'ACTIVE',$4::jsonb,$5,$6::uuid,0) returning *",
      [
        input.userId,
        targetSkillId,
        input.mode ?? "CHALLENGE_ME",
        JSON.stringify(frozenBlueprint),
        ASSESSMENT_BLUEPRINT_VERSION,
        sourceTaskId
      ]
    ));
    const assessment = assessmentRows[0];
    const assessmentId = String(assessment.id);

    await sql.begin(async tx => {
      for (let index = 0; index < selected.length; index += 1) {
        const question = selected[index];
        await tx.unsafe(
          "insert into public.skill_assessment_questions(assessment_id,bank_question_id,ordinal,type,concept_ids,difficulty,prompt,options,answer_key,rubric,source,generator_version) values ($1::uuid,$2::uuid,$3,$4,$5::jsonb,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12)",
          [
            assessmentId,
            String(question.id),
            index + 1,
            String(question.type),
            JSON.stringify([String(question.concept_id)]),
            Number(question.difficulty),
            String(question.prompt),
            JSON.stringify(question.options ?? []),
            JSON.stringify(question.answer_key ?? {}),
            JSON.stringify(question.rubric ?? {}),
            String(question.source),
            ASSESSMENT_QUESTION_VERSION
          ]
        );
      }

      await tx.unsafe(
        "insert into public.skill_assessment_generation_runs(assessment_id,request_hash,status,provider,model_version,retry_count) values ($1::uuid,$2,'COMPLETE','SEEDED',$3,0)",
        [assessmentId, requestHash, ASSESSMENT_QUESTION_VERSION]
      );

      await tx.unsafe(
        "insert into public.agent_events(user_id,event_type,trigger_type,trigger_ref,summary,entity_refs,metadata) values ($1::uuid,'assessment.started','CHALLENGE_ME',$2,$3,$4::jsonb,$5::jsonb)",
        [
          input.userId,
          assessmentId,
          "Started a " + selected.length + "-item validation challenge for " + String(skill.canonical_name) + ".",
          JSON.stringify([{ type: "assessment", id: assessmentId }, { type: "skill", id: targetSkillId }]),
          JSON.stringify({ blueprintVersion: ASSESSMENT_BLUEPRINT_VERSION, itemCount: selected.length })
        ]
      );
    });

    const firstRows = rows(await sql.unsafe(
      "select id,ordinal,type,concept_ids,difficulty,prompt,options from public.skill_assessment_questions where assessment_id=$1::uuid order by ordinal limit 1",
      [assessmentId]
    ));

    return {
      assessment: {
        id: assessmentId,
        skill: {
          id: targetSkillId,
          slug: String(skill.slug),
          name: String(skill.canonical_name)
        },
        mode: input.mode ?? "CHALLENGE_ME",
        status: "ACTIVE",
        blueprint: frozenBlueprint,
        progress: { answered: 0, total: selected.length }
      },
      question: publicQuestion(firstRows[0])
    };
  }

  async get(userId: string, assessmentId: string) {
    const sql = getSql();
    const assessmentRows = rows(await sql.unsafe(
      "select a.*,s.slug,s.canonical_name from public.skill_assessments a join public.skills s on s.id=a.skill_id where a.id=$1::uuid and a.user_id=$2::uuid limit 1",
      [assessmentId, userId]
    ));
    const assessment = assessmentRows[0];
    if (!assessment) throw new Error("ASSESSMENT_NOT_FOUND");

    const attemptRows = rows(await sql.unsafe(
      "select question_id,score,feedback,created_at from public.skill_assessment_attempts where assessment_id=$1::uuid and user_id=$2::uuid order by created_at",
      [assessmentId, userId]
    ));

    if (String(assessment.status) === "COMPLETED") {
      const outcomeRows = rows(await sql.unsafe(
        "select * from public.skill_assessment_outcomes where assessment_id=$1::uuid limit 1",
        [assessmentId]
      ));
      return {
        assessment: this.assessmentDto(assessment, attemptRows.length),
        question: null,
        outcome: outcomeRows[0] ?? null
      };
    }

    const nextOrdinal = attemptRows.length + 1;
    const questionRows = rows(await sql.unsafe(
      "select id,ordinal,type,concept_ids,difficulty,prompt,options from public.skill_assessment_questions where assessment_id=$1::uuid and ordinal=$2 limit 1",
      [assessmentId, nextOrdinal]
    ));

    return {
      assessment: this.assessmentDto(assessment, attemptRows.length),
      question: questionRows[0] ? publicQuestion(questionRows[0]) : null,
      outcome: null
    };
  }

  async submitAnswer(input: SubmitAnswerInput) {
    const sql = getSql();

    const assessmentRows = rows(await sql.unsafe(
      "select a.*,s.canonical_name from public.skill_assessments a join public.skills s on s.id=a.skill_id where a.id=$1::uuid and a.user_id=$2::uuid limit 1",
      [input.assessmentId, input.userId]
    ));
    const assessment = assessmentRows[0];
    if (!assessment) throw new Error("ASSESSMENT_NOT_FOUND");
    if (String(assessment.status) !== "ACTIVE") {
      if (String(assessment.status) === "COMPLETED") return this.get(input.userId, input.assessmentId);
      throw new Error("ASSESSMENT_NOT_ACTIVE");
    }

    const questionRows = rows(await sql.unsafe(
      "select * from public.skill_assessment_questions where id=$1::uuid and assessment_id=$2::uuid limit 1",
      [input.questionId, input.assessmentId]
    ));
    const question = questionRows[0];
    if (!question) throw new Error("QUESTION_NOT_FOUND");

    const answeredRows = rows(await sql.unsafe(
      "select count(*)::int answered from public.skill_assessment_attempts where assessment_id=$1::uuid and user_id=$2::uuid",
      [input.assessmentId, input.userId]
    ));
    const expectedOrdinal = Number(answeredRows[0]?.answered ?? 0) + 1;
    if (Number(question.ordinal) !== expectedOrdinal) throw new Error("STALE_QUESTION");

    const idempotencyKey = input.idempotencyKey?.trim()
      || createHash("sha256")
        .update([input.assessmentId, input.questionId, input.optionId].join("|"))
        .digest("hex");

    const existingRows = rows(await sql.unsafe(
      "select * from public.skill_assessment_attempts where user_id=$1::uuid and idempotency_key=$2 limit 1",
      [input.userId, idempotencyKey]
    ));
    if (existingRows[0]) {
      return this.afterAttempt(input.userId, input.assessmentId, existingRows[0]);
    }

    if (String(question.type) !== "MCQ") throw new Error("UNSUPPORTED_QUESTION_TYPE");
    const evaluation = evaluateMcq(question, input.optionId);
    const conceptId = jsonArray(question.concept_ids)[0] ?? "unknown";

    let attempt: Row | null = null;
    await sql.begin(async tx => {
      const inserted = rows(await tx.unsafe(
        "insert into public.skill_assessment_attempts(assessment_id,question_id,user_id,answer_payload,status,score,evaluator_confidence,feedback,error_tag,evaluation_version,idempotency_key) values ($1::uuid,$2::uuid,$3::uuid,$4::jsonb,'EVALUATED',$5,$6,$7,$8,$9,$10) returning *",
        [
          input.assessmentId,
          input.questionId,
          input.userId,
          JSON.stringify({ optionId: input.optionId }),
          evaluation.score,
          evaluation.evaluatorConfidence,
          evaluation.feedback,
          evaluation.errorTag,
          ASSESSMENT_EVALUATION_VERSION,
          idempotencyKey
        ]
      ));
      attempt = inserted[0];

      await tx.unsafe(
        "insert into public.skill_assessment_concept_signals(attempt_id,assessment_id,user_id,skill_id,concept_id,polarity,strength,difficulty,error_tag,evaluator_confidence) values ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8,$9,$10)",
        [
          String(attempt!.id),
          input.assessmentId,
          input.userId,
          String(assessment.skill_id),
          conceptId,
          evaluation.score >= 0.75 ? "POSITIVE" : "NEGATIVE",
          evaluation.score >= 0.75 ? evaluation.score : 1 - evaluation.score,
          Number(question.difficulty),
          evaluation.errorTag,
          evaluation.evaluatorConfidence
        ]
      );

      await tx.unsafe(
        "update public.skill_assessments set current_question_index=$1 where id=$2::uuid and user_id=$3::uuid",
        [expectedOrdinal, input.assessmentId, input.userId]
      );
    });

    return this.afterAttempt(input.userId, input.assessmentId, attempt!);
  }

  private async afterAttempt(userId: string, assessmentId: string, attempt: Row) {
    const sql = getSql();
    const counts = rows(await sql.unsafe(
      "select (select count(*) from public.skill_assessment_attempts where assessment_id=$1::uuid)::int answered,(select count(*) from public.skill_assessment_questions where assessment_id=$1::uuid)::int total",
      [assessmentId]
    ))[0];
    const answered = Number(counts.answered);
    const total = Number(counts.total);

    if (answered >= total) {
      const completion = await this.complete(userId, assessmentId);
      return {
        completed: true,
        feedback: {
          score: Number(attempt.score),
          text: String(attempt.feedback)
        },
        ...completion
      };
    }

    const nextRows = rows(await sql.unsafe(
      "select id,ordinal,type,concept_ids,difficulty,prompt,options from public.skill_assessment_questions where assessment_id=$1::uuid and ordinal=$2 limit 1",
      [assessmentId, answered + 1]
    ));

    return {
      completed: false,
      feedback: {
        score: Number(attempt.score),
        text: String(attempt.feedback)
      },
      progress: { answered, total },
      question: publicQuestion(nextRows[0])
    };
  }

  private async complete(userId: string, assessmentId: string) {
    const sql = getSql();

    const existingOutcomeRows = rows(await sql.unsafe(
      "select * from public.skill_assessment_outcomes where assessment_id=$1::uuid and user_id=$2::uuid limit 1",
      [assessmentId, userId]
    ));
    if (existingOutcomeRows[0]?.evidence_batch_result) {
      return {
        outcome: existingOutcomeRows[0],
        evidence: existingOutcomeRows[0].evidence_batch_result,
        gapAnalysis: existingOutcomeRows[0].gap_snapshot_id
          ? { snapshotId: String(existingOutcomeRows[0].gap_snapshot_id) }
          : null
      };
    }

    const assessmentRows = rows(await sql.unsafe(
      "select a.*,s.canonical_name from public.skill_assessments a join public.skills s on s.id=a.skill_id where a.id=$1::uuid and a.user_id=$2::uuid limit 1",
      [assessmentId, userId]
    ));
    const assessment = assessmentRows[0];
    if (!assessment) throw new Error("ASSESSMENT_NOT_FOUND");

    const signalRows = rows(await sql.unsafe(
      "select concept_id,polarity,strength,difficulty,evaluator_confidence from public.skill_assessment_concept_signals where assessment_id=$1::uuid and user_id=$2::uuid order by created_at",
      [assessmentId, userId]
    ));
    const attemptRows = rows(await sql.unsafe(
      "select a.score,q.difficulty,q.concept_ids from public.skill_assessment_attempts a join public.skill_assessment_questions q on q.id=a.question_id where a.assessment_id=$1::uuid and a.user_id=$2::uuid order by q.ordinal",
      [assessmentId, userId]
    ));
    if (!attemptRows.length) throw new Error("ASSESSMENT_HAS_NO_ATTEMPTS");

    let weightedScore = 0;
    let totalWeight = 0;
    const conceptStats = new Map<string, { score: number; count: number }>();

    for (const row of attemptRows) {
      const difficulty = Number(row.difficulty);
      const weight = 0.8 + 0.1 * difficulty;
      const score = Number(row.score);
      weightedScore += score * weight;
      totalWeight += weight;
      const conceptId = jsonArray(row.concept_ids)[0] ?? "unknown";
      const current = conceptStats.get(conceptId) ?? { score: 0, count: 0 };
      current.score += score;
      current.count += 1;
      conceptStats.set(conceptId, current);
    }

    const normalizedScore = totalWeight ? weightedScore / totalWeight : 0;
    const blueprintJson = jsonObject(assessment.blueprint_json);
    const targets = Array.isArray(blueprintJson.conceptTargets)
      ? blueprintJson.conceptTargets as Array<Record<string, unknown>>
      : [];
    const coveredConcepts = new Set(signalRows.map(row => String(row.concept_id)));
    const targetConcepts = new Set(targets.map(item => String(item.conceptId)));
    const coverage = targetConcepts.size
      ? [...targetConcepts].filter(id => coveredConcepts.has(id)).length / targetConcepts.size
      : Math.min(1, coveredConcepts.size / Math.max(attemptRows.length, 1));

    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const conceptSummary: Record<string, number> = {};
    for (const [conceptId, stat] of conceptStats) {
      const score = stat.score / stat.count;
      conceptSummary[conceptId] = Number(score.toFixed(3));
      if (score >= 0.75) strengths.push(conceptId);
      else weaknesses.push(conceptId);
    }

    const assessmentConfidence = Math.min(
      0.95,
      0.58 + 0.22 * coverage + 0.15 * Math.min(attemptRows.length / 6, 1)
    );
    const levelSignal = Math.min(3.5, Math.max(0.4, 0.4 + normalizedScore * 2.5));

    const outcomeRows = rows(await sql.unsafe(
      "insert into public.skill_assessment_outcomes(assessment_id,user_id,skill_id,normalized_score,level_signal,coverage,assessment_confidence,strengths,weaknesses,concept_summary,aggregator_version) values ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11) on conflict(assessment_id) do update set normalized_score=excluded.normalized_score,level_signal=excluded.level_signal,coverage=excluded.coverage,assessment_confidence=excluded.assessment_confidence,strengths=excluded.strengths,weaknesses=excluded.weaknesses,concept_summary=excluded.concept_summary returning *",
      [
        assessmentId,
        userId,
        String(assessment.skill_id),
        Number(normalizedScore.toFixed(4)),
        Number(levelSignal.toFixed(3)),
        Number(coverage.toFixed(4)),
        Number(assessmentConfidence.toFixed(4)),
        JSON.stringify(strengths),
        JSON.stringify(weaknesses),
        JSON.stringify(conceptSummary),
        ASSESSMENT_AGGREGATOR_VERSION
      ]
    ));
    let outcome = outcomeRows[0];

    const evidenceResult = await getEvidenceEngine().ingestBatch({
      userId,
      trigger: { type: "ASSESSMENT_COMPLETED", ref: assessmentId },
      producerVersion: ASSESSMENT_AGGREGATOR_VERSION,
      candidates: [{
        skillId: String(assessment.skill_id),
        sourceType: "ASSESSMENT_SUMMARY",
        sourceRef: assessmentId,
        sourceGroupId: "assessment:" + assessmentId,
        claim: "Completed " + attemptRows.length + "-item " + String(assessment.canonical_name) + " challenge. Strengths: "
          + (strengths.join(", ") || "none yet") + ". Weaknesses: " + (weaknesses.join(", ") || "none detected") + ".",
        levelSignal: Number(levelSignal.toFixed(3)),
        directness: 1,
        quality: Number(assessmentConfidence.toFixed(4)),
        coverage: Number(coverage.toFixed(4)),
        metadata: {
          assessmentId,
          normalizedScore: Number(normalizedScore.toFixed(4)),
          strengths,
          weaknesses,
          conceptSummary
        },
        idempotencyKey: "assessment:" + assessmentId + ":summary"
      }]
    });

    const gapResult = evidenceResult.downstream.runGapAnalysis
      ? await getGapAnalysisService().recompute(userId, { type: "ASSESSMENT_SKILL_DELTA", ref: assessmentId })
      : null;

    let replanResult: unknown = null;
    let replanWarning: string | null = null;
    try {
      replanResult = await getAdaptiveReplannerService().considerAssessment({
        userId,
        assessmentId,
        skillId: String(assessment.skill_id),
        weaknesses,
        evidenceIds: evidenceResult.acceptedEvidenceIds,
        gapSnapshotId: gapResult?.snapshotId ?? null
      });
    } catch (replanError) {
      replanWarning = "REPLAN_FAILED";
      console.error("assessment.replan.failed", {
        assessmentId,
        error: replanError instanceof Error ? replanError.message : String(replanError)
      });
    }

    await sql.begin(async tx => {
      await tx.unsafe(
        "update public.skill_assessment_outcomes set evidence_batch_result=$1::jsonb,gap_snapshot_id=$2::uuid where assessment_id=$3::uuid and user_id=$4::uuid",
        [
          JSON.stringify(evidenceResult),
          gapResult?.snapshotId ?? null,
          assessmentId,
          userId
        ]
      );
      await tx.unsafe(
        "update public.skill_assessments set status='COMPLETED',completed_at=now() where id=$1::uuid and user_id=$2::uuid",
        [assessmentId, userId]
      );
      await tx.unsafe(
        "insert into public.agent_events(user_id,event_type,trigger_type,trigger_ref,summary,entity_refs,evidence_refs,metadata) values ($1::uuid,'assessment.completed','ASSESSMENT',$2,$3,$4::jsonb,$5::jsonb,$6::jsonb)",
        [
          userId,
          assessmentId,
          "Completed " + String(assessment.canonical_name) + " validation at " + Math.round(normalizedScore * 100) + "% assessment score.",
          JSON.stringify([{ type: "assessment", id: assessmentId }, { type: "skill", id: String(assessment.skill_id) }]),
          JSON.stringify(evidenceResult.acceptedEvidenceIds),
          JSON.stringify({ strengths, weaknesses, levelSignal, coverage })
        ]
      );
    });

    const refreshed = rows(await sql.unsafe(
      "select * from public.skill_assessment_outcomes where assessment_id=$1::uuid limit 1",
      [assessmentId]
    ));
    outcome = refreshed[0] ?? outcome;

    return {
      outcome,
      evidence: evidenceResult,
      gapAnalysis: gapResult
        ? {
            snapshotId: gapResult.snapshotId,
            readiness: gapResult.readiness,
            evidenceCoverage: gapResult.evidenceCoverage
          }
        : null,
      replan: replanResult,
      warnings: replanWarning ? [replanWarning] : []
    };
  }

  private assessmentDto(assessment: Row, answered: number) {
    const blueprintJson = jsonObject(assessment.blueprint_json);
    const total = Number(blueprintJson.maxItems ?? 0);
    return {
      id: String(assessment.id),
      skill: {
        id: String(assessment.skill_id),
        slug: String(assessment.slug ?? ""),
        name: String(assessment.canonical_name ?? "")
      },
      mode: String(assessment.mode),
      status: String(assessment.status),
      blueprint: blueprintJson,
      progress: { answered, total }
    };
  }
}

let service: AssessmentService | null = null;

export function getAssessmentService() {
  if (!service) service = new AssessmentService();
  return service;
}
