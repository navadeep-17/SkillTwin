import "server-only";
import {z} from "zod";
import {getSql} from "@/lib/db/postgres";
import {getGeminiStructuredClient} from "@/lib/ai/gemini-interactions";
import {parseArenaState,type ArenaState,type ArenaTopic} from "@/lib/domain/arena";

const answerSchema=z.object({answers:z.array(z.number().int().min(0).max(3)).length(5)}).strict();
const answerJsonSchema={type:"object",properties:{
  answers:{type:"array",items:{type:"integer",minimum:0,maximum:3},minItems:5,maxItems:5}
},required:["answers"],additionalProperties:false};

export async function startAiAfterWait(userId:string):Promise<ArenaState>{
  const sql=getSql();
  const reserved=await sql.begin(async tx=>{
    await tx`select pg_advisory_xact_lock(74351,hashtext(${userId}))`;
    // Match finder holds the topic lock before locking candidate lobby rows.
    // Follow that order or concurrent real-player pairing can deadlock.
    const [firstRead]=await tx`select topic from public.arena_lobby
      where user_id=${userId}::uuid`;
    if(!firstRead)return null;
    const topic=String(firstRead.topic) as ArenaTopic;
    await tx`select pg_advisory_xact_lock(74352,hashtext(${topic}))`;
    const [lobby]=await tx`select topic,status,
      (clock_timestamp()>=queued_at+interval '20 seconds') as eligible
      from public.arena_lobby where user_id=${userId}::uuid for update`;
    if(lobby?.status!=="WAITING"||lobby.topic!==topic||!lobby.eligible)return null;
    const [existing]=await tx`select id,
      (mode='PREPARING' and created_at>clock_timestamp()-interval '25 seconds') as pending,
      (mode in ('AI','SOLO') and started_at>clock_timestamp()-interval '150 seconds') as active
      from public.arena_ai_sessions where user_id=${userId}::uuid for update`;
    if(existing?.pending||existing?.active)return null;
    await tx`delete from public.arena_ai_sessions where user_id=${userId}::uuid`;
    await tx`delete from public.arena_lobby where user_id=${userId}::uuid and status='WAITING'`;
    const [created]=await tx`insert into public.arena_ai_sessions(user_id,topic,mode)
      values(${userId}::uuid,${topic},'PREPARING') returning id`;
    return {sessionId:String(created.id),topic};
  });
  if(!reserved)return getArenaState(userId);
  let picks:number[]|null=null;
  try{
    const rows=await sql`select question_no,prompt,options from public.arena_questions
      where topic=${reserved.topic} order by question_no limit 5`;
    if(rows.length!==5)throw Error("ARENA_QUESTION_BANK_INCOMPLETE");
    const questions=rows.map(q=>({
      number:Number(q.question_no),prompt:String(q.prompt),options:q.options
    }));
    const response=await getGeminiStructuredClient().generateJson({
      systemInstruction:"You are a clearly labeled AI coding quiz opponent. Answer each multiple-choice "+
        "question independently, without an answer key or external tools. Choose one option index 0–3 "+
        "for each question. Return exactly five option indices, in order, without explanations.",
      prompt:JSON.stringify({topic:reserved.topic,questions}),
      validator:answerSchema,jsonSchema:answerJsonSchema,
      timeoutMs:7000,maxOutputTokens:180
    });
    picks=response?.answers??null;
  }catch(error){
    console.warn("arena.ai.solo_fallback",{
      reason:error instanceof Error?error.name:"ModelFailure"
    });
  }
  const valid=answerSchema.safeParse({answers:picks});
  const aiPicks=valid.success?valid.data.answers:null;
  // DB table has zero client privileges. No public function permits choosing AI picks.
  await sql`update public.arena_ai_sessions set mode=${aiPicks?"AI":"SOLO"},
    picks=${aiPicks??null}::smallint[],started_at=clock_timestamp()
    where id=${reserved.sessionId}::uuid and user_id=${userId}::uuid and mode='PREPARING'`;
  return getArenaState(userId);
}

export async function getAiState(userId:string):Promise<ArenaState|null>{
  const sql=getSql();
  // A crashed model request cannot leave someone stuck in preparation indefinitely.
  await sql`update public.arena_ai_sessions set mode='SOLO',started_at=clock_timestamp()
    where user_id=${userId}::uuid and mode='PREPARING'
    and created_at<clock_timestamp()-interval '25 seconds'`;
  const [session]=await sql`select id,topic,mode,started_at,
    case when started_at is null then 0 else
      greatest(0,floor(extract(epoch from(clock_timestamp()-started_at))/30)::integer+1)
    end as current_question
    from public.arena_ai_sessions where user_id=${userId}::uuid`;
  if(!session)return null;
  const mode=String(session.mode),topic=String(session.topic) as ArenaTopic;
  const matchId=String(session.id);
  if(mode==="PREPARING")return parseArenaState({status:"AI_PREPARING",topic});
  const q=Number(session.current_question);
  if(q>5){
    const [mine]=await sql`select count(*)::integer as score from public.arena_ai_answers a
      join public.arena_questions b on b.topic=${topic} and b.question_no=a.question_no
      where a.session_id=${matchId}::uuid and a.user_id=${userId}::uuid
      and a.option_index=b.correct_option`;
    const myScore=Number(mine.score);
    if(mode==="SOLO")return parseArenaState({
      status:"SOLO_FINISHED",topic,matchId,totalQuestions:5,myScore
    });
    const [theirs]=await sql`select count(*)::integer as score
      from public.arena_questions q join public.arena_ai_sessions s
      on s.id=${matchId}::uuid where q.topic=${topic}
      and q.correct_option=s.picks[q.question_no]`;
    const rivalScore=Number(theirs.score);
    return parseArenaState({
      status:"AI_FINISHED",topic,matchId,totalQuestions:5,myScore,rivalScore,
      outcome:myScore>rivalScore?"WIN":myScore<rivalScore?"LOSS":"TIE"
    });
  }
  const [question]=await sql`select prompt,options from public.arena_questions
    where topic=${topic} and question_no=${q}`;
  if(!question)throw Error("ARENA_QUESTION_BANK_INCOMPLETE");
  const [answer]=await sql`select exists(select 1 from public.arena_ai_answers
    where session_id=${matchId}::uuid and user_id=${userId}::uuid
    and question_no=${q}) as answered`;
  const [timer]=await sql`select greatest(0,ceil(extract(epoch from
    (${session.started_at}::timestamptz+${q}*interval '30 seconds'-clock_timestamp())))::integer) as seconds`;
  return parseArenaState({
    status:mode==="AI"?"AI_PLAYING":"SOLO_PLAYING",topic,matchId,
    questionNumber:q,totalQuestions:5,question:String(question.prompt),
    options:question.options,answered:Boolean(answer.answered),
    rivalAnswered:mode==="AI",secondsRemaining:Number(timer.seconds)
  });
}

export async function getArenaState(userId:string):Promise<ArenaState>{
  const ai=await getAiState(userId);
  if(ai&&!["AI_FINISHED","SOLO_FINISHED"].includes(ai.status))return ai;
  const [human]=await getSql()`select topic,status,
    greatest(0,ceil(extract(epoch from
      (queued_at+interval '20 seconds'-clock_timestamp())))::integer) as remaining
    from public.arena_lobby where user_id=${userId}::uuid`;
  if(human?.status==="WAITING")return parseArenaState({
    status:"WAITING",topic:human.topic,aiAvailableInSeconds:Number(human.remaining)
  });
  if(human?.status==="PLAYING"){
    const {createClient}=await import("@/lib/supabase/server");
    const supabase=await createClient();
    const {data,error}=await supabase.rpc("arena_get_state");
    if(error)throw error;
    return parseArenaState(data);
  }
  return ai??parseArenaState({status:"IDLE"});
}

export async function submitAiAnswer(userId:string,input:{
  matchId:string;questionNumber:number;optionIndex:number
}):Promise<boolean>{
  const rows=await getSql()`insert into public.arena_ai_answers
    (session_id,user_id,question_no,option_index)
    select id,user_id,${input.questionNumber},${input.optionIndex}
    from public.arena_ai_sessions where id=${input.matchId}::uuid
    and user_id=${userId}::uuid and mode in ('AI','SOLO')
    and floor(extract(epoch from(clock_timestamp()-started_at))/30)::integer+1
      =${input.questionNumber}
    and ${input.questionNumber} between 1 and 5 and ${input.optionIndex} between 0 and 3
    on conflict do nothing returning 1 as accepted`;
  return rows.length>0;
}
