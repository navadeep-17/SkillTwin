import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getSql } from "@/lib/db/postgres";
import { getGeminiStructuredClient } from "@/lib/ai/gemini-interactions";
import { getEvidenceEngine } from "@/lib/services/skills/evidence-service";
import { getGapAnalysisService } from "@/lib/services/gaps/gap-analysis-service";
import { getAdaptiveTriggerService } from "@/lib/services/replanner/adaptive-trigger-service";

export const ASSESSMENT_BLUEPRINT_VERSION = "assessment-blueprint-e2";
export const ASSESSMENT_EVALUATION_VERSION = "adaptive-evaluator-e2";
export const ASSESSMENT_AGGREGATOR_VERSION = "assessment-aggregator-e2";
export const ASSESSMENT_QUESTION_VERSION = "adaptive-bank-e2";

type Row = Record<string, unknown>;
const rows = (value: unknown) => value as Row[];

function jsonArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}
function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function clamp(value:number,min=0,max=1){return Math.max(min,Math.min(max,value));}

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

function blueprint(skillId:string,concepts:string[],startDifficulty:number,mode:string) {
  return {
    skillId,
    conceptTargets:concepts.map(conceptId=>({conceptId,weight:1/Math.max(concepts.length,1),minObservations:1})),
    difficultyMin:1,
    difficultyMax:4,
    startDifficulty,
    allowedTypes:["MCQ","SHORT_TEXT","SCENARIO"],
    minItems:mode==="CALIBRATION"?5:4,
    maxItems:Math.min(8,Math.max(mode==="CALIBRATION"?6:5,concepts.length+2)),
    targetCoverage:mode==="CALIBRATION"?0.90:0.80,
    stopConfidence:mode==="CALIBRATION"?0.82:0.78,
    blueprintVersion:ASSESSMENT_BLUEPRINT_VERSION
  };
}

function evaluateMcq(question:Row,optionId:string) {
  const key=jsonObject(question.answer_key);
  const rubric=jsonObject(question.rubric);
  const correct=String(key.correctOptionId ?? "");
  const score=optionId===correct?1:0;
  return {
    score,
    evaluatorConfidence:1,
    feedback:score?String(rubric.correctFeedback ?? "Correct."):String(rubric.incorrectFeedback ?? "Review this concept."),
    errorTag:score?null:(jsonArray(question.concept_ids)[0] ?? "concept_gap"),
    criterionScores:{choice:score},
    ambiguity:"LOW" as const
  };
}

const semanticEvaluationSchema=z.object({
  score:z.number().min(0).max(1),
  evaluatorConfidence:z.number().min(0).max(1),
  ambiguity:z.enum(["LOW","MEDIUM","HIGH"]),
  feedback:z.string().min(1).max(700),
  errorTag:z.string().max(120).nullable(),
  criterionScores:z.record(z.number().min(0).max(1))
});
const semanticEvaluationJsonSchema:Record<string,unknown>={
  type:"object",
  properties:{
    score:{type:"number"},
    evaluatorConfidence:{type:"number"},
    ambiguity:{type:"string",enum:["LOW","MEDIUM","HIGH"]},
    feedback:{type:"string"},
    errorTag:{type:["string","null"]},
    criterionScores:{type:"object",additionalProperties:{type:"number"}}
  },
  required:["score","evaluatorConfidence","ambiguity","feedback","errorTag","criterionScores"]
};

const generatedQuestionSchema=z.object({
  type:z.enum(["MCQ","SHORT_TEXT","SCENARIO"]),
  conceptId:z.string().min(1).max(120),
  difficulty:z.number().int().min(1).max(4),
  prompt:z.string().min(10).max(1200),
  options:z.array(z.object({id:z.string().min(1).max(12),text:z.string().min(1).max(400)})).max(6).nullable(),
  answerKey:z.record(z.unknown()),
  rubric:z.record(z.unknown())
});
const generatedQuestionJsonSchema:Record<string,unknown>={
  type:"object",
  properties:{
    type:{type:"string",enum:["MCQ","SHORT_TEXT","SCENARIO"]},
    conceptId:{type:"string"},
    difficulty:{type:"integer"},
    prompt:{type:"string"},
    options:{type:["array","null"],items:{type:"object",properties:{id:{type:"string"},text:{type:"string"}},required:["id","text"]}},
    answerKey:{type:"object"},
    rubric:{type:"object"}
  },
  required:["type","conceptId","difficulty","prompt","options","answerKey","rubric"]
};

export interface ChallengeCreateInput {
  userId:string;
  targetSkillId?:string;
  sourceTaskId?:string;
  mode?:"CHALLENGE_ME"|"SCHEDULED_VALIDATION"|"CALIBRATION"|"CONFLICT_RESOLUTION";
}
export interface SubmitAnswerInput {
  userId:string;
  assessmentId:string;
  questionId:string;
  optionId?:string;
  textAnswer?:string;
  idempotencyKey?:string;
}

type Evaluation={
  score:number;
  evaluatorConfidence:number;
  feedback:string;
  errorTag:string|null;
  criterionScores:Record<string,number>;
  ambiguity:"LOW"|"MEDIUM"|"HIGH";
};

export class AssessmentService {
  async create(input:ChallengeCreateInput) {
    const sql=getSql();
    let targetSkillId=input.targetSkillId ?? null;
    let sourceTaskId=input.sourceTaskId ?? null;
    const mode=input.mode ?? "CHALLENGE_ME";

    if(sourceTaskId){
      const task=rows(await sql.unsafe(
        "select t.skill_id from public.learning_tasks t join public.learning_plans p on p.id=t.plan_id where t.id=$1::uuid and p.user_id=$2::uuid limit 1",
        [sourceTaskId,input.userId]
      ))[0];
      if(!task) throw new Error("SOURCE_TASK_NOT_FOUND");
      targetSkillId=String(task.skill_id);
    }

    if(!targetSkillId){
      const candidate=rows(await sql.unsafe(
        "select sgr.skill_id,sgr.priority_score,sgr.current_confidence from public.skill_gap_results sgr join public.gap_snapshots gs on gs.id=sgr.snapshot_id where gs.user_id=$1::uuid and gs.id=(select id from public.gap_snapshots where user_id=$1::uuid order by created_at desc limit 1) and exists(select 1 from public.assessment_question_bank qb where qb.skill_id=sgr.skill_id and qb.is_active=true) order by (sgr.priority_score*(1.25-sgr.current_confidence)) desc limit 1",
        [input.userId]
      ))[0];
      if(!candidate) throw new Error("NO_ASSESSABLE_SKILL");
      targetSkillId=String(candidate.skill_id);
    }

    const [skill,state,bankRows]=await Promise.all([
      sql.unsafe("select id,slug,canonical_name from public.skills where id=$1::uuid and is_active=true limit 1",[targetSkillId]),
      sql.unsafe("select capability_score,confidence,last_validated_at from public.user_skills where user_id=$1::uuid and skill_id=$2::uuid limit 1",[input.userId,targetSkillId]),
      sql.unsafe("select * from public.assessment_question_bank where skill_id=$1::uuid and is_active=true order by difficulty,id",[targetSkillId])
    ]);
    const skillRow=rows(skill)[0], stateRow=rows(state)[0], bank=rows(bankRows);
    if(!skillRow) throw new Error("SKILL_NOT_FOUND");
    if(bank.length<4) throw new Error("QUESTION_BANK_TOO_SMALL");

    const currentScore=stateRow?.capability_score==null?null:Number(stateRow.capability_score);
    const startDifficulty=currentScore==null?2:currentScore<1.3?1:currentScore<2.3?2:currentScore<3.2?3:4;
    const concepts=[...new Set(bank.map(row=>String(row.concept_id)))];
    const frozenBlueprint=blueprint(targetSkillId,concepts,startDifficulty,mode);
    const assessmentRows=rows(await sql.unsafe(
      "insert into public.skill_assessments(user_id,skill_id,mode,status,blueprint_json,blueprint_version,source_task_id,current_question_index) values ($1::uuid,$2::uuid,$3,'ACTIVE',$4::jsonb,$5,$6::uuid,0) returning *",
      [input.userId,targetSkillId,mode,JSON.stringify(frozenBlueprint),ASSESSMENT_BLUEPRINT_VERSION,sourceTaskId]
    ));
    const assessmentId=String(assessmentRows[0].id);
    const requestHash=createHash("sha256").update(JSON.stringify({input,targetSkillId,blueprintVersion:ASSESSMENT_BLUEPRINT_VERSION})).digest("hex");

    const first=this.chooseBankQuestion(bank,[],concepts,startDifficulty,new Map(),[]);
    if(!first) throw new Error("QUESTION_SELECTION_FAILED");
    await this.persistQuestion(assessmentId,1,first);

    await sql.begin(async tx=>{
      await tx.unsafe(
        "insert into public.skill_assessment_generation_runs(assessment_id,request_hash,status,provider,model_version,retry_count) values ($1::uuid,$2,'COMPLETE','SEEDED',$3,0)",
        [assessmentId,requestHash,ASSESSMENT_QUESTION_VERSION]
      );
      await tx.unsafe(
        "insert into public.agent_events(user_id,event_type,trigger_type,trigger_ref,summary,entity_refs,metadata) values ($1::uuid,'assessment.started',$2,$3,$4,$5::jsonb,$6::jsonb)",
        [input.userId,mode,assessmentId,"Started adaptive validation for "+String(skillRow.canonical_name)+".",JSON.stringify([{type:"assessment",id:assessmentId},{type:"skill",id:targetSkillId}]),JSON.stringify({blueprintVersion:ASSESSMENT_BLUEPRINT_VERSION,startDifficulty,maxItems:frozenBlueprint.maxItems})]
      );
    });

    const firstRows=rows(await sql.unsafe(
      "select id,ordinal,type,concept_ids,difficulty,prompt,options from public.skill_assessment_questions where assessment_id=$1::uuid and ordinal=1 limit 1",
      [assessmentId]
    ));

    return {
      assessment:{
        id:assessmentId,
        skill:{id:targetSkillId,slug:String(skillRow.slug),name:String(skillRow.canonical_name)},
        mode,status:"ACTIVE",blueprint:frozenBlueprint,
        progress:{answered:0,total:Number(frozenBlueprint.maxItems),minimum:Number(frozenBlueprint.minItems)}
      },
      question:publicQuestion(firstRows[0])
    };
  }

  async get(userId:string,assessmentId:string) {
    const sql=getSql();
    const assessment=rows(await sql.unsafe(
      "select a.*,s.slug,s.canonical_name from public.skill_assessments a join public.skills s on s.id=a.skill_id where a.id=$1::uuid and a.user_id=$2::uuid limit 1",
      [assessmentId,userId]
    ))[0];
    if(!assessment) throw new Error("ASSESSMENT_NOT_FOUND");
    const attempts=rows(await sql.unsafe(
      "select question_id,score,feedback,created_at from public.skill_assessment_attempts where assessment_id=$1::uuid and user_id=$2::uuid order by created_at",
      [assessmentId,userId]
    ));
    if(String(assessment.status)==="COMPLETED"){
      const outcome=rows(await sql.unsafe("select * from public.skill_assessment_outcomes where assessment_id=$1::uuid limit 1",[assessmentId]))[0] ?? null;
      return {assessment:this.assessmentDto(assessment,attempts.length),question:null,outcome};
    }
    const nextOrdinal=attempts.length+1;
    let question:Row|null=rows(await sql.unsafe(
      "select id,ordinal,type,concept_ids,difficulty,prompt,options from public.skill_assessment_questions where assessment_id=$1::uuid and ordinal=$2 limit 1",
      [assessmentId,nextOrdinal]
    ))[0] ?? null;
    if(!question && String(assessment.status)==="ACTIVE"){
      question=await this.ensureNextQuestion(userId,assessmentId,assessment,attempts.length);
    }
    return {assessment:this.assessmentDto(assessment,attempts.length),question:question?publicQuestion(question):null,outcome:null};
  }

  async abandon(userId:string,assessmentId:string) {
    const sql=getSql();
    const result=rows(await sql.unsafe(
      "update public.skill_assessments set status='ABANDONED',completed_at=now() where id=$1::uuid and user_id=$2::uuid and status='ACTIVE' returning id,skill_id",
      [assessmentId,userId]
    ));
    if(!result[0]) throw new Error("ASSESSMENT_NOT_ACTIVE");
    await sql.unsafe(
      "insert into public.agent_events(user_id,event_type,trigger_type,trigger_ref,summary,entity_refs) values ($1::uuid,'assessment.abandoned','ASSESSMENT',$2,'Assessment session abandoned without changing SkillTwin.',$3::jsonb)",
      [userId,assessmentId,JSON.stringify([{type:"assessment",id:assessmentId}])]
    );
    return {assessmentId,status:"ABANDONED"};
  }

  async submitAnswer(input:SubmitAnswerInput) {
    const sql=getSql();
    const assessment=rows(await sql.unsafe(
      "select a.*,s.canonical_name,s.slug from public.skill_assessments a join public.skills s on s.id=a.skill_id where a.id=$1::uuid and a.user_id=$2::uuid limit 1",
      [input.assessmentId,input.userId]
    ))[0];
    if(!assessment) throw new Error("ASSESSMENT_NOT_FOUND");
    if(String(assessment.status)!=="ACTIVE"){
      if(String(assessment.status)==="COMPLETED") return this.get(input.userId,input.assessmentId);
      throw new Error("ASSESSMENT_NOT_ACTIVE");
    }
    const question=rows(await sql.unsafe(
      "select * from public.skill_assessment_questions where id=$1::uuid and assessment_id=$2::uuid limit 1",
      [input.questionId,input.assessmentId]
    ))[0];
    if(!question) throw new Error("QUESTION_NOT_FOUND");

    const answered=Number(rows(await sql.unsafe(
      "select count(*)::int answered from public.skill_assessment_attempts where assessment_id=$1::uuid and user_id=$2::uuid",
      [input.assessmentId,input.userId]
    ))[0]?.answered ?? 0);
    if(Number(question.ordinal)!==answered+1) throw new Error("STALE_QUESTION");

    const answerPayload=String(question.type)==="MCQ"
      ? {optionId:input.optionId ?? ""}
      : {text:input.textAnswer?.trim() ?? ""};
    if(String(question.type)==="MCQ" && !answerPayload.optionId) throw new Error("ANSWER_REQUIRED");
    if(String(question.type)!=="MCQ" && !("text" in answerPayload && answerPayload.text)) throw new Error("ANSWER_REQUIRED");

    const idempotencyKey=input.idempotencyKey?.trim() || createHash("sha256")
      .update(JSON.stringify({assessmentId:input.assessmentId,questionId:input.questionId,answerPayload}))
      .digest("hex");
    const existing=rows(await sql.unsafe(
      "select * from public.skill_assessment_attempts where user_id=$1::uuid and idempotency_key=$2 limit 1",
      [input.userId,idempotencyKey]
    ))[0];
    if(existing) return this.afterAttempt(input.userId,input.assessmentId,existing);

    const evaluation=String(question.type)==="MCQ"
      ? evaluateMcq(question,input.optionId ?? "")
      : await this.evaluateSemantic(question,input.textAnswer?.trim() ?? "",String(assessment.canonical_name));

    const conceptId=jsonArray(question.concept_ids)[0] ?? "unknown";
    const polarity=evaluation.evaluatorConfidence<0.60 || evaluation.ambiguity==="HIGH"
      ? "MIXED"
      : evaluation.score>=0.72 ? "SUPPORTS" : evaluation.score<=0.38 ? "CONTRADICTS" : "MIXED";
    const strength=evaluation.evaluatorConfidence<0.60
      ? Math.min(0.35,Math.abs(evaluation.score-0.5)*2)
      : clamp(Math.abs(evaluation.score-0.5)*2);

    let attempt:Row|null=null;
    await sql.begin(async tx=>{
      const inserted=rows(await tx.unsafe(
        "insert into public.skill_assessment_attempts(assessment_id,question_id,user_id,answer_payload,status,score,evaluator_confidence,feedback,error_tag,evaluation_version,idempotency_key) values ($1::uuid,$2::uuid,$3::uuid,$4::jsonb,'EVALUATED',$5,$6,$7,$8,$9,$10) returning *",
        [input.assessmentId,input.questionId,input.userId,JSON.stringify(answerPayload),evaluation.score,evaluation.evaluatorConfidence,evaluation.feedback,evaluation.errorTag,ASSESSMENT_EVALUATION_VERSION,idempotencyKey]
      ));
      attempt=inserted[0];
      await tx.unsafe(
        "insert into public.skill_assessment_concept_signals(attempt_id,assessment_id,user_id,skill_id,concept_id,polarity,strength,difficulty,error_tag,evaluator_confidence) values ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8,$9,$10)",
        [String(attempt!.id),input.assessmentId,input.userId,String(assessment.skill_id),conceptId,polarity,strength,Number(question.difficulty),evaluation.errorTag,evaluation.evaluatorConfidence]
      );
      await tx.unsafe(
        "update public.skill_assessments set current_question_index=$1 where id=$2::uuid and user_id=$3::uuid",
        [answered+1,input.assessmentId,input.userId]
      );
    });
    return this.afterAttempt(input.userId,input.assessmentId,attempt!);
  }

  private async evaluateSemantic(question:Row,answer:string,skillName:string):Promise<Evaluation> {
    const key=jsonObject(question.answer_key);
    const rubric=jsonObject(question.rubric);
    try {
      const result=await getGeminiStructuredClient().generateJson({
        systemInstruction:
          "Evaluate a learner answer using only the supplied persisted rubric. Return bounded criterion scores and concise feedback. Do not infer broad learner ability, reveal hidden reasoning, or add criteria.",
        prompt:[
          "Skill: "+skillName,
          "Question: "+String(question.prompt),
          "Difficulty: "+String(question.difficulty),
          "Answer: "+answer,
          "Reference answer: "+String(key.referenceAnswer ?? ""),
          "Persisted rubric: "+JSON.stringify(rubric),
          "Allowed criterion IDs: "+JSON.stringify(Array.isArray(rubric.criteria)?(rubric.criteria as Array<Record<string,unknown>>).map(x=>String(x.id)):[]),
          "Score only the answer against those criteria. If the answer is ambiguous or off-topic, lower evaluatorConfidence rather than forcing certainty."
        ].join("\n"),
        jsonSchema:semanticEvaluationJsonSchema,
        validator:semanticEvaluationSchema
      });
      if(result) return result;
    } catch(error){
      console.error("assessment.semantic_eval.failed",{error:error instanceof Error?error.message:String(error)});
    }

    const expected=jsonArray(key.expectedKeywords).map(x=>x.toLowerCase());
    const normalized=answer.toLowerCase();
    const matches=expected.filter(keyword=>normalized.includes(keyword)).length;
    const score=expected.length?clamp(matches/Math.max(2,Math.ceil(expected.length*0.7))):0.5;
    return {
      score:Number(score.toFixed(3)),
      evaluatorConfidence:0.62,
      ambiguity:"MEDIUM",
      feedback:score>=0.7?"Your answer covers the main persisted rubric ideas.":"Your answer only partially matches the persisted rubric. Review the key concept and try a targeted follow-up.",
      errorTag:score>=0.7?null:(jsonArray(question.concept_ids)[0] ?? "concept_gap"),
      criterionScores:{fallback_keyword_match:Number(score.toFixed(3))}
    };
  }

  private async afterAttempt(userId:string,assessmentId:string,attempt:Row) {
    const sql=getSql();
    const assessment=rows(await sql.unsafe(
      "select a.*,s.canonical_name,s.slug from public.skill_assessments a join public.skills s on s.id=a.skill_id where a.id=$1::uuid and a.user_id=$2::uuid limit 1",
      [assessmentId,userId]
    ))[0];
    if(!assessment) throw new Error("ASSESSMENT_NOT_FOUND");

    const attemptRows=rows(await sql.unsafe(
      "select a.*,q.difficulty,q.concept_ids,q.type from public.skill_assessment_attempts a join public.skill_assessment_questions q on q.id=a.question_id where a.assessment_id=$1::uuid and a.user_id=$2::uuid order by q.ordinal",
      [assessmentId,userId]
    ));
    const belief=await this.temporaryBelief(assessment,attemptRows);
    const blueprintJson=jsonObject(assessment.blueprint_json);
    const answered=attemptRows.length;
    const minItems=Number(blueprintJson.minItems ?? 4);
    const maxItems=Number(blueprintJson.maxItems ?? 6);
    const targetCoverage=Number(blueprintJson.targetCoverage ?? 0.8);
    const stopConfidence=Number(blueprintJson.stopConfidence ?? 0.78);

    const shouldStop=answered>=maxItems || (answered>=minItems && belief.coverage>=targetCoverage && belief.assessmentConfidence>=stopConfidence);
    if(shouldStop){
      const completion=await this.complete(userId,assessmentId);
      return {
        completed:true,
        feedback:{score:Number(attempt.score),text:String(attempt.feedback)},
        adaptive:{coverage:belief.coverage,assessmentConfidence:belief.assessmentConfidence,nextDifficulty:null,focusConcept:null,stoppingReason:answered>=maxItems?"MAX_ITEMS":"TARGET_CONFIDENCE"},
        ...completion
      };
    }

    const next=await this.ensureNextQuestion(userId,assessmentId,assessment,answered,belief);
    if(!next){
      const completion=await this.complete(userId,assessmentId);
      return {
        completed:true,
        feedback:{score:Number(attempt.score),text:String(attempt.feedback)},
        adaptive:{coverage:belief.coverage,assessmentConfidence:belief.assessmentConfidence,nextDifficulty:null,focusConcept:null,stoppingReason:"NO_VALID_QUESTION"},
        ...completion
      };
    }

    return {
      completed:false,
      feedback:{score:Number(attempt.score),text:String(attempt.feedback)},
      progress:{answered,total:maxItems,minimum:minItems},
      adaptive:{coverage:belief.coverage,assessmentConfidence:belief.assessmentConfidence,nextDifficulty:Number(next.difficulty),focusConcept:jsonArray(next.concept_ids)[0] ?? null},
      question:publicQuestion(next)
    };
  }

  private async temporaryBelief(assessment:Row,attempts:Row[]) {
    const blueprintJson=jsonObject(assessment.blueprint_json);
    const targets=Array.isArray(blueprintJson.conceptTargets)?blueprintJson.conceptTargets as Array<Record<string,unknown>>:[];
    const stats=new Map<string,{support:number;contradiction:number;observations:number;maxDifficulty:number}>();
    let qualitySum=0;
    const types=new Set<string>();
    for(const row of attempts){
      const concept=jsonArray(row.concept_ids)[0] ?? "unknown";
      const stat=stats.get(concept) ?? {support:0,contradiction:0,observations:0,maxDifficulty:0};
      const score=Number(row.score), confidence=Number(row.evaluator_confidence), difficulty=Number(row.difficulty);
      const weight=confidence*(0.85+0.10*difficulty);
      if(score>=0.5) stat.support += (score-0.5)*2*weight;
      else stat.contradiction += (0.5-score)*2*weight;
      stat.observations += 1;
      stat.maxDifficulty=Math.max(stat.maxDifficulty,difficulty);
      stats.set(concept,stat);
      qualitySum += confidence;
      types.add(String(row.type));
    }
    const totalWeight=targets.reduce((sum,item)=>sum+Number(item.weight ?? 0),0) || 1;
    const coveredWeight=targets.reduce((sum,item)=>{
      const required=Number(item.minObservations ?? 1);
      const seen=stats.get(String(item.conceptId))?.observations ?? 0;
      return sum+Number(item.weight ?? 0)*Math.min(seen/required,1);
    },0);
    const coverage=clamp(coveredWeight/totalWeight);
    const evaluatorQuality=attempts.length?qualitySum/attempts.length:0;
    const consistency=attempts.length<2?0.7:clamp(1-(attempts.filter(row=>Number(row.score)>0.65).length>0 && attempts.filter(row=>Number(row.score)<0.35).length>0?0.25:0.05));
    const itemDiversity=clamp(types.size/3);
    const assessmentConfidence=clamp(0.45*coverage+0.30*evaluatorQuality+0.15*consistency+0.10*itemDiversity,0,0.95);
    const last=attempts.at(-1);
    let currentDifficulty=Number(last?.difficulty ?? blueprintJson.startDifficulty ?? 2);
    const lastScore=Number(last?.score ?? 0.5), lastConfidence=Number(last?.evaluator_confidence ?? 0.7);
    if(lastScore>=0.80 && lastConfidence>=0.70) currentDifficulty=Math.min(Number(blueprintJson.difficultyMax ?? 4),currentDifficulty+1);
    else if(lastScore<=0.40) currentDifficulty=Math.max(Number(blueprintJson.difficultyMin ?? 1),currentDifficulty-1);
    return {stats,coverage,assessmentConfidence,currentDifficulty};
  }

  private async ensureNextQuestion(userId:string,assessmentId:string,assessment:Row,answered:number,belief?:Awaited<ReturnType<AssessmentService["temporaryBelief"]>>) {
    const sql=getSql();
    const existing=rows(await sql.unsafe(
      "select id,ordinal,type,concept_ids,difficulty,prompt,options from public.skill_assessment_questions where assessment_id=$1::uuid and ordinal=$2 limit 1",
      [assessmentId,answered+1]
    ))[0];
    if(existing) return existing;

    const attemptRows=belief?[]:rows(await sql.unsafe(
      "select a.*,q.difficulty,q.concept_ids,q.type from public.skill_assessment_attempts a join public.skill_assessment_questions q on q.id=a.question_id where a.assessment_id=$1::uuid and a.user_id=$2::uuid order by q.ordinal",
      [assessmentId,userId]
    ));
    const localBelief=belief ?? await this.temporaryBelief(assessment,attemptRows);
    const used=rows(await sql.unsafe(
      "select bank_question_id,type from public.skill_assessment_questions where assessment_id=$1::uuid order by ordinal",
      [assessmentId]
    ));
    const usedIds=used.map(row=>row.bank_question_id?String(row.bank_question_id):"").filter(Boolean);
    const usedTypes=used.map(row=>String(row.type));
    const bank=rows(await sql.unsafe(
      "select * from public.assessment_question_bank where skill_id=$1::uuid and is_active=true order by difficulty,id",
      [String(assessment.skill_id)]
    ));
    const blueprintJson=jsonObject(assessment.blueprint_json);
    const concepts=(Array.isArray(blueprintJson.conceptTargets)?blueprintJson.conceptTargets as Array<Record<string,unknown>>:[]).map(x=>String(x.conceptId));
    const chosen=this.chooseBankQuestion(bank,usedIds,concepts,localBelief.currentDifficulty,localBelief.stats,usedTypes);
    if(chosen){
      await this.persistQuestion(assessmentId,answered+1,chosen);
      return rows(await sql.unsafe(
        "select id,ordinal,type,concept_ids,difficulty,prompt,options from public.skill_assessment_questions where assessment_id=$1::uuid and ordinal=$2 limit 1",
        [assessmentId,answered+1]
      ))[0];
    }

    const generated=await this.generateQuestion(assessment,concepts,localBelief.currentDifficulty,localBelief.stats);
    if(!generated) return null;
    await this.persistQuestion(assessmentId,answered+1,generated);
    return rows(await sql.unsafe(
      "select id,ordinal,type,concept_ids,difficulty,prompt,options from public.skill_assessment_questions where assessment_id=$1::uuid and ordinal=$2 limit 1",
      [assessmentId,answered+1]
    ))[0];
  }

  private chooseBankQuestion(
    bank:Row[],usedIds:string[],concepts:string[],difficulty:number,
    stats:Map<string,{support:number;contradiction:number;observations:number;maxDifficulty:number}>,
    usedTypes:string[]
  ) {
    const used=new Set(usedIds);
    const candidates=bank.filter(row=>!used.has(String(row.id)) && concepts.includes(String(row.concept_id)));
    const scored=candidates.map(row=>{
      const concept=String(row.concept_id), stat=stats.get(concept);
      const conceptNeed=!stat?1:stat.contradiction>stat.support?0.95:stat.observations<2?0.65:0.25;
      const diffFit=1-Math.min(Math.abs(Number(row.difficulty)-difficulty)/3,1);
      const diversity=usedTypes.includes(String(row.type))?0:0.15;
      return {row,score:0.60*conceptNeed+0.30*diffFit+0.10*diversity};
    }).sort((a,b)=>b.score-a.score || Number(a.row.difficulty)-Number(b.row.difficulty) || String(a.row.id).localeCompare(String(b.row.id)));
    return scored[0]?.row ?? null;
  }

  private async generateQuestion(
    assessment:Row,concepts:string[],difficulty:number,
    stats:Map<string,{support:number;contradiction:number;observations:number;maxDifficulty:number}>
  ):Promise<Row|null> {
    const concept=[...concepts].sort((a,b)=>{
      const left=stats.get(a), right=stats.get(b);
      const leftNeed=!left?2:(left.contradiction-left.support)+(left.observations<2?0.5:0);
      const rightNeed=!right?2:(right.contradiction-right.support)+(right.observations<2?0.5:0);
      return rightNeed-leftNeed;
    })[0];
    if(!concept) return null;
    try {
      const result=await getGeminiStructuredClient().generateJson({
        systemInstruction:"Generate one bounded SkillTwin assessment item. Use only the supplied skill/concept/difficulty. Include an objectively scorable answer key or explicit rubric. Do not include hidden reasoning.",
        prompt:[
          "Skill: "+String(assessment.canonical_name ?? assessment.skill_id),
          "Concept: "+concept,
          "Difficulty: "+difficulty,
          "Allowed types: MCQ, SHORT_TEXT, SCENARIO.",
          "Prefer SHORT_TEXT or SCENARIO when the bank lacks a suitable deterministic item.",
          "For MCQ use 4 options and exactly one correctOptionId. For semantic items provide referenceAnswer/expectedKeywords and rubric criteria."
        ].join("\n"),
        jsonSchema:generatedQuestionJsonSchema,
        validator:generatedQuestionSchema
      });
      if(!result || result.conceptId!==concept || result.difficulty<1 || result.difficulty>4) return null;
      if(result.type==="MCQ"){
        const options=result.options ?? [];
        const correct=String(result.answerKey.correctOptionId ?? "");
        if(options.length<3 || !options.some(option=>option.id===correct)) return null;
      } else {
        const criteria=Array.isArray(result.rubric.criteria)?result.rubric.criteria:[];
        if(criteria.length<1) return null;
      }
      return {
        id:null,
        type:result.type,
        concept_id:result.conceptId,
        difficulty:result.difficulty,
        prompt:result.prompt,
        options:result.options,
        answer_key:result.answerKey,
        rubric:result.rubric,
        source:"AI_GENERATED",
        version:"gemini-generated-e2"
      };
    } catch {
      return null;
    }
  }

  private async persistQuestion(assessmentId:string,ordinal:number,question:Row) {
    const sql=getSql();
    await sql.unsafe(
      "insert into public.skill_assessment_questions(assessment_id,bank_question_id,ordinal,type,concept_ids,difficulty,prompt,options,answer_key,rubric,source,generator_version) values ($1::uuid,$2::uuid,$3,$4,$5::jsonb,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12)",
      [
        assessmentId,question.id?String(question.id):null,ordinal,String(question.type),JSON.stringify([String(question.concept_id)]),
        Number(question.difficulty),String(question.prompt),JSON.stringify(question.options ?? null),JSON.stringify(question.answer_key ?? {}),
        JSON.stringify(question.rubric ?? {}),String(question.source ?? "SEEDED"),String(question.version ?? ASSESSMENT_QUESTION_VERSION)
      ]
    );
  }

  private async complete(userId:string,assessmentId:string) {
    const sql=getSql();
    const existing=rows(await sql.unsafe(
      "select * from public.skill_assessment_outcomes where assessment_id=$1::uuid and user_id=$2::uuid limit 1",
      [assessmentId,userId]
    ))[0];
    if(existing?.evidence_batch_result){
      return {outcome:existing,evidence:existing.evidence_batch_result,gapAnalysis:existing.gap_snapshot_id?{snapshotId:String(existing.gap_snapshot_id)}:null,replan:null,warnings:[]};
    }

    const assessment=rows(await sql.unsafe(
      "select a.*,s.canonical_name from public.skill_assessments a join public.skills s on s.id=a.skill_id where a.id=$1::uuid and a.user_id=$2::uuid limit 1",
      [assessmentId,userId]
    ))[0];
    if(!assessment) throw new Error("ASSESSMENT_NOT_FOUND");
    const attempts=rows(await sql.unsafe(
      "select a.*,q.difficulty,q.concept_ids,q.type,q.prompt from public.skill_assessment_attempts a join public.skill_assessment_questions q on q.id=a.question_id where a.assessment_id=$1::uuid and a.user_id=$2::uuid order by q.ordinal",
      [assessmentId,userId]
    ));
    if(!attempts.length) throw new Error("ASSESSMENT_HAS_NO_ATTEMPTS");

    const belief=await this.temporaryBelief(assessment,attempts);
    let weighted=0,totalWeight=0,maxDifficulty=1;
    const conceptStats=new Map<string,{score:number;weight:number}>();
    for(const row of attempts){
      const difficulty=Number(row.difficulty), confidence=Number(row.evaluator_confidence), score=Number(row.score);
      const difficultyFactor=({1:0.85,2:1,3:1.15,4:1.25} as Record<number,number>)[difficulty] ?? 1;
      const contribution=confidence*difficultyFactor;
      weighted += score*contribution; totalWeight += contribution; maxDifficulty=Math.max(maxDifficulty,difficulty);
      const concept=jsonArray(row.concept_ids)[0] ?? "unknown";
      const stat=conceptStats.get(concept) ?? {score:0,weight:0};
      stat.score += score*contribution; stat.weight += contribution; conceptStats.set(concept,stat);
    }
    const normalizedScore=totalWeight?weighted/totalWeight:0;
    const strengths:string[]=[],weaknesses:string[]=[];
    const conceptSummary:Record<string,number>={};
    for(const [concept,stat] of conceptStats){
      const score=stat.weight?stat.score/stat.weight:0;
      conceptSummary[concept]=Number(score.toFixed(3));
      if(score>=0.72) strengths.push(concept); else if(score<=0.55) weaknesses.push(concept);
    }

    let levelSignal=normalizedScore<0.4?0.8:normalizedScore<0.65?1.5:normalizedScore<0.82?2.1:(maxDifficulty>=3?2.8:2.3);
    if(belief.coverage<0.55 || belief.assessmentConfidence<0.60) levelSignal=Math.min(levelSignal,1.7);
    levelSignal=clamp(levelSignal,0.4,3.2);

    const outcome=rows(await sql.unsafe(
      "insert into public.skill_assessment_outcomes(assessment_id,user_id,skill_id,normalized_score,level_signal,coverage,assessment_confidence,strengths,weaknesses,concept_summary,aggregator_version) values ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11) on conflict(assessment_id) do update set normalized_score=excluded.normalized_score,level_signal=excluded.level_signal,coverage=excluded.coverage,assessment_confidence=excluded.assessment_confidence,strengths=excluded.strengths,weaknesses=excluded.weaknesses,concept_summary=excluded.concept_summary returning *",
      [assessmentId,userId,String(assessment.skill_id),Number(normalizedScore.toFixed(4)),Number(levelSignal.toFixed(3)),Number(belief.coverage.toFixed(4)),Number(belief.assessmentConfidence.toFixed(4)),JSON.stringify(strengths),JSON.stringify(weaknesses),JSON.stringify(conceptSummary),ASSESSMENT_AGGREGATOR_VERSION]
    ))[0];

    const childCandidates=attempts.map((row,index)=>{
      const score=Number(row.score), confidence=Number(row.evaluator_confidence), concept=jsonArray(row.concept_ids)[0] ?? "unknown";
      return {
        skillId:String(assessment.skill_id),
        sourceType:"ASSESSMENT_QUESTION" as const,
        sourceRef:String(row.question_id),
        sourceGroupId:"assessment:"+assessmentId,
        claim:"Assessment item "+(index+1)+" on "+concept+": "+(score>=0.72?"demonstrated":"needs reinforcement")+".",
        levelSignal:Number((0.5+score*2.2).toFixed(3)),
        polarity:score>=0.72?"SUPPORTS" as const:score<=0.38?"CONTRADICTS" as const:"NEUTRAL" as const,
        directness:1,
        quality:confidence,
        coverage:Math.min(0.22,1/Math.max(attempts.length,1)),
        metadata:{assessmentId,conceptId:concept,score,difficulty:Number(row.difficulty),questionType:String(row.type)},
        idempotencyKey:"assessment:"+assessmentId+":q:"+String(row.question_id)
      };
    });
    const summaryCandidate={
      skillId:String(assessment.skill_id),
      sourceType:"ASSESSMENT_SUMMARY" as const,
      sourceRef:assessmentId,
      sourceGroupId:"assessment:"+assessmentId,
      claim:"Completed "+attempts.length+"-item "+String(assessment.canonical_name)+" validation. Strengths: "+(strengths.join(", ")||"none confirmed")+". Weaknesses: "+(weaknesses.join(", ")||"none detected")+".",
      levelSignal:Number(levelSignal.toFixed(3)),
      polarity:"SUPPORTS" as const,
      directness:1,
      quality:Number(belief.assessmentConfidence.toFixed(4)),
      coverage:Number(belief.coverage.toFixed(4)),
      metadata:{assessmentId,normalizedScore:Number(normalizedScore.toFixed(4)),strengths,weaknesses,conceptSummary,maxDifficulty},
      idempotencyKey:"assessment:"+assessmentId+":summary"
    };

    const evidenceResult=await getEvidenceEngine().ingestBatch({
      userId,trigger:{type:"ASSESSMENT_COMPLETED",ref:assessmentId},producerVersion:ASSESSMENT_AGGREGATOR_VERSION,
      candidates:[...childCandidates,summaryCandidate]
    });
    const gapResult=evidenceResult.downstream.runGapAnalysis
      ? await getGapAnalysisService().recompute(userId,{type:"ASSESSMENT_SKILL_DELTA",ref:assessmentId})
      : null;

    let replanResult:unknown=null,replanWarning:string|null=null;
    try {
      replanResult=await getAdaptiveTriggerService().considerAssessment({
        userId,
        assessmentId,
        skillId:String(assessment.skill_id),
        weaknesses,
        strengths,
        normalizedScore:Number(normalizedScore.toFixed(4)),
        assessmentConfidence:Number(belief.assessmentConfidence.toFixed(4)),
        evidenceIds:evidenceResult.acceptedEvidenceIds,
        gapSnapshotId:gapResult?.snapshotId ?? null
      });
    } catch(error){
      replanWarning="REPLAN_FAILED";
      console.error("assessment.replan.failed",{assessmentId,error:error instanceof Error?error.message:String(error)});
    }

    await sql.begin(async tx=>{
      await tx.unsafe(
        "update public.skill_assessment_outcomes set evidence_batch_result=$1::jsonb,gap_snapshot_id=$2::uuid where assessment_id=$3::uuid and user_id=$4::uuid",
        [JSON.stringify(evidenceResult),gapResult?.snapshotId ?? null,assessmentId,userId]
      );
      await tx.unsafe("update public.skill_assessments set status='COMPLETED',completed_at=now() where id=$1::uuid and user_id=$2::uuid",[assessmentId,userId]);
      await tx.unsafe(
        "insert into public.agent_events(user_id,event_type,trigger_type,trigger_ref,summary,entity_refs,evidence_refs,metadata) values ($1::uuid,'assessment.completed','ASSESSMENT',$2,$3,$4::jsonb,$5::jsonb,$6::jsonb)",
        [userId,assessmentId,"Completed "+String(assessment.canonical_name)+" adaptive validation at "+Math.round(normalizedScore*100)+"% assessment score.",JSON.stringify([{type:"assessment",id:assessmentId},{type:"skill",id:String(assessment.skill_id)}]),JSON.stringify(evidenceResult.acceptedEvidenceIds),JSON.stringify({strengths,weaknesses,levelSignal,coverage:belief.coverage,assessmentConfidence:belief.assessmentConfidence})]
      );
    });

    const refreshed=rows(await sql.unsafe("select * from public.skill_assessment_outcomes where assessment_id=$1::uuid limit 1",[assessmentId]))[0] ?? outcome;
    return {
      outcome:refreshed,evidence:evidenceResult,
      gapAnalysis:gapResult?{snapshotId:gapResult.snapshotId,readiness:gapResult.readiness,evidenceCoverage:gapResult.evidenceCoverage}:null,
      replan:replanResult,warnings:replanWarning?[replanWarning]:[]
    };
  }

  private assessmentDto(assessment:Row,answered:number) {
    const blueprintJson=jsonObject(assessment.blueprint_json);
    return {
      id:String(assessment.id),
      skill:{id:String(assessment.skill_id),slug:String(assessment.slug ?? ""),name:String(assessment.canonical_name ?? "")},
      mode:String(assessment.mode),status:String(assessment.status),blueprint:blueprintJson,
      progress:{answered,total:Number(blueprintJson.maxItems ?? 0),minimum:Number(blueprintJson.minItems ?? 0)}
    };
  }
}

let service:AssessmentService|null=null;
export function getAssessmentService(){if(!service) service=new AssessmentService();return service;}
