"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import Link from "next/link";
import {
  ArrowLeft,CheckCircle2,Clock3,LoaderCircle,RefreshCw,
  Bot,ShieldCheck,Swords,Trophy,UsersRound,X
} from "lucide-react";
import {
  ARENA_LABELS,ARENA_TOPICS,type ArenaState,type ArenaTopic,
  parseArenaState
} from "@/lib/domain/arena";

type Envelope={ok:boolean;data?:{arena?:unknown;accepted?:boolean};
  error?:{message?:string}};
type LocalPick={key:string;option:number};

const validError=(reply:Envelope)=>reply.error?.message??"Please retry.";
const questionKey=(state:ArenaState)=>{
  return ["PLAYING","AI_PLAYING","SOLO_PLAYING"].includes(state.status)
    && "matchId" in state && "questionNumber" in state
    ?state.matchId+":"+state.questionNumber:"";
};

export function ArenaDuel(){
  const [topic,setTopic]=useState<ArenaTopic>("python");
  const [arena,setArena]=useState<ArenaState>({status:"IDLE"});
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [autoAi,setAutoAi]=useState(true);
  const [aiBusy,setAiBusy]=useState(false);
  const aiInFlight=useRef(false);
  const aiRetryAfter=useRef(0);
  const [answering,setAnswering]=useState(false);
  const [error,setError]=useState("");
  const [localPick,setLocalPick]=useState<LocalPick|null>(null);
  const activeRef=useRef(false);

  const refresh=useCallback(async()=>{
    if(activeRef.current)return;
    activeRef.current=true;
    try{
      const response=await fetch("/api/arena/state",{cache:"no-store"});
      const data:Envelope=await response.json();
      if(!response.ok||!data.ok)throw Error(validError(data));
      const next=parseArenaState(data.data?.arena);
      setArena(next);
      setError("");
    }catch(err){
      setError(err instanceof Error?err.message:"Could not synchronize Arena.");
    }finally{
      setLoading(false);
      activeRef.current=false;
    }
  },[]);

  useEffect(()=>{void refresh()},[refresh]);
  useEffect(()=>{
    if(!["WAITING","PLAYING","AI_PREPARING","AI_PLAYING","SOLO_PLAYING"].includes(arena.status))return;
    const handle=window.setInterval(()=>void refresh(),1500);
    return ()=>window.clearInterval(handle);
  },[arena.status,refresh]);

  const startAi=useCallback(async()=>{
    if(aiInFlight.current||Date.now()<aiRetryAfter.current)return;
    aiInFlight.current=true;setAiBusy(true);setError("");
    try{
      const response=await fetch("/api/arena/ai",{
        method:"POST",headers:{"Content-Type":"application/json"}
      });
      const payload:Envelope=await response.json();
      if(!response.ok||!payload.ok)throw Error(validError(payload));
      setArena(parseArenaState(payload.data?.arena));
      setLocalPick(null);
    }catch(err){
      setError(err instanceof Error?err.message:"Unable to start AI practice.");
      aiRetryAfter.current=Date.now()+10000;
    }finally{aiInFlight.current=false;setAiBusy(false)}
  },[]);

  useEffect(()=>{
    if(arena.status==="WAITING"&&autoAi&&!busy&&!aiBusy
      && arena.aiAvailableInSeconds===0&&Date.now()>=aiRetryAfter.current){
      void startAi();
    }
  },[arena,autoAi,busy,aiBusy,startAi]);

  async function changeQueue(action:"find"|"cancel"){
    if(busy)return;
    setBusy(true);setError("");
    try{
      const response=await fetch("/api/arena/match",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify(action==="find"?{action,topic}:{action})
      });
      const payload:Envelope=await response.json();
      if(!response.ok||!payload.ok)throw Error(validError(payload));
      setArena(parseArenaState(payload.data?.arena));
      setLocalPick(null);
    }catch(err){setError(err instanceof Error?err.message:"Could not update the matchmaking queue.")}
    finally{setBusy(false)}
  }

  async function answer(index:number){
    if(!["PLAYING","AI_PLAYING","SOLO_PLAYING"].includes(arena.status)||!("answered" in arena)||!("matchId" in arena)||!("questionNumber" in arena)||arena.answered||answering||!("secondsRemaining" in arena)||arena.secondsRemaining===0)return;
    const key=questionKey(arena);
    setAnswering(true);setError("");
    try{
      const response=await fetch("/api/arena/answer",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          matchId:arena.matchId,questionNumber:arena.questionNumber,optionIndex:index,
          mode:arena.status==="AI_PLAYING"?"AI":arena.status==="SOLO_PLAYING"?"SOLO":"HUMAN"
        })
      });
      const payload:Envelope=await response.json();
      if(!response.ok||!payload.ok)throw Error(validError(payload));
      if(payload.data?.accepted){
        setLocalPick({key,option:index});
        setArena(current=>["PLAYING","AI_PLAYING","SOLO_PLAYING"].includes(current.status)&&questionKey(current)===key
          ?{...current,answered:true}:current);
      }else{
        await refresh();
      }
    }catch(err){
      setError(err instanceof Error?err.message:"This answer could not be submitted.");
      await refresh();
    }finally{setAnswering(false)}
  }

  const playing=["PLAYING","AI_PLAYING","SOLO_PLAYING"].includes(arena.status);
  const isAi=arena.status==="AI_PLAYING"||arena.status==="AI_FINISHED";
  const isSolo=arena.status==="SOLO_PLAYING"||arena.status==="SOLO_FINISHED";
  const waiting=arena.status==="WAITING";
  const finished=["FINISHED","AI_FINISHED","SOLO_FINISHED"].includes(arena.status);
  const picked=playing&&localPick?.key===questionKey(arena)?localPick.option:null;

  return <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
    <Link href="/overview" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600">
      <ArrowLeft className="size-4"/> Back to SkillTwin
    </Link>

    <div className="relative mt-5 overflow-hidden rounded-[28px] bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-10 sm:py-10">
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-28 size-80 rounded-full bg-violet-600/25 blur-3xl"/>
      <div className="relative">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.13em] text-indigo-100">
          <Swords className="size-3.5"/> SkillTwin Arena · 1v1 Beta
        </div>
        <h1 className="mt-5 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Meet a random rival. Prove what you know.
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300">
          Find a real learner first, then switch to a clearly labeled AI rival after 20 seconds if nobody is available.
          Your answers are scored on the server, not by the browser.
        </p>
        <div className="mt-5 flex flex-wrap gap-4 text-xs font-medium text-indigo-100">
          <span className="inline-flex items-center gap-1.5"><UsersRound className="size-4"/> Humans first · AI fallback</span>
          <span className="inline-flex items-center gap-1.5"><Clock3 className="size-4"/> 2m 30s per round</span>
          <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-4"/> Practice only</span>
        </div>
      </div>
    </div>

    {error?<div role="alert" className="mt-5 flex items-start justify-between gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <span>{error}</span>
      <button type="button" aria-label="Retry synchronization" onClick={()=>void refresh()} className="shrink-0 text-red-700"><RefreshCw className="size-4"/></button>
    </div>:null}

    {loading?<section className="mt-6 flex min-h-[260px] items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600" role="status">
      <LoaderCircle className="size-5 animate-spin"/> Checking your Arena session…
    </section>:null}

    {!loading&&arena.status==="IDLE"?<section className="mt-6 grid gap-5 lg:grid-cols-[1fr_0.72fr]">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-2">
          <UsersRound className="size-5 text-indigo-600"/>
          <h2 className="text-xl font-semibold text-slate-900">Find your opponent</h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Choose one skill. SkillTwin pairs you with another signed-in learner waiting for the same topic.
        </p>
        <fieldset className="mt-7">
          <legend className="text-sm font-semibold text-slate-800">Your challenge subject</legend>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {ARENA_TOPICS.map(value=><label key={value}
              className={"cursor-pointer rounded-xl border px-2 py-4 text-center text-xs font-semibold transition sm:text-sm "+
                (topic===value?"border-indigo-500 bg-indigo-50 text-indigo-700":"border-slate-200 bg-white text-slate-700 hover:border-slate-300")}>
              <input type="radio" name="arena-topic" value={value} checked={topic===value}
                onChange={()=>setTopic(value)} className="sr-only"/>
              {ARENA_LABELS[value]}
            </label>)}
          </div>
        </fieldset>
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-sm text-indigo-900">
          <input type="checkbox" checked={autoAi} onChange={event=>setAutoAi(event.target.checked)}
            className="mt-1 accent-indigo-600"/>
          <span><strong>AI fallback after 20 seconds</strong><span className="mt-1 block text-xs leading-5 text-indigo-700">
            If no human is available, challenge a labeled AI rival. If the model is unavailable, switch to solo practice.
          </span></span>
        </label>
        <button type="button" onClick={()=>void changeQueue("find")} disabled={busy}
          className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-700 disabled:opacity-60">
          {busy?<LoaderCircle className="size-4 animate-spin"/>:<Swords className="size-4"/>}
          Find a random rival
        </button>
      </div>
      <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <h3 className="font-semibold text-slate-900">The rules of Arena</h3>
        <div className="mt-5 space-y-4">
          {[
            ["01","Match","Search for a real player first; after 20 seconds, AI fallback is available."],
            ["02","Compete","Five independently curated MCQs appear for both rivals on a shared clock."],
            ["03","Reveal","Final scores and the winner are shown after the round ends."]
          ].map(([index,name,body])=><div key={index} className="flex gap-3">
            <span className="text-sm font-semibold text-indigo-500">{index}</span>
            <div><p className="text-sm font-semibold text-slate-900">{name}</p><p className="mt-1 text-xs leading-5 text-slate-600">{body}</p></div>
          </div>)}
        </div>
        <p className="mt-6 rounded-xl border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-500">
          This is friendly practice, not a verified assessment. Match results do not alter your skill score, roadmap, or evidence passport.
        </p>
      </aside>
    </section>:null}

    {!loading&&arena.status==="WAITING"?<section className="mx-auto mt-6 max-w-2xl rounded-2xl border border-indigo-200 bg-white px-6 py-10 text-center shadow-sm" role="status" aria-live="polite">
      <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-indigo-50">
        <LoaderCircle className="size-10 animate-spin text-indigo-600"/>
      </div>
      <h2 className="mt-5 text-2xl font-semibold text-slate-900">Looking for a rival…</h2>
      <p className="mt-2 text-sm text-slate-600">{ARENA_LABELS[arena.topic]} · Waiting for a real learner</p>
      <p className="mx-auto mt-3 max-w-md text-xs leading-6 text-slate-500">
        Still searching for a real player. If nobody joins, you can practise against a clearly labeled AI rival or on your own.
      </p>
      <p className="mt-3 text-sm font-semibold text-indigo-700">
        {arena.aiAvailableInSeconds
          ? "AI practice available in "+arena.aiAvailableInSeconds+"s"
          : aiBusy?"Preparing an AI rival…":"AI practice is available"}
      </p>
      <label className="mx-auto mt-3 flex max-w-sm items-center justify-center gap-2 text-xs text-slate-700">
        <input type="checkbox" checked={autoAi} onChange={event=>setAutoAi(event.target.checked)}
          className="accent-indigo-600"/>
        Automatically switch to AI if no one joins
      </label>
      {!arena.aiAvailableInSeconds&&!autoAi?
        <button type="button" onClick={()=>void startAi()} disabled={aiBusy}
          className="mt-4 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          Play against AI now
        </button>:null}
      <button type="button" onClick={()=>void changeQueue("cancel")} disabled={busy||aiBusy}
        className="mt-6 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
        <X className="size-4"/> Cancel search
      </button>
    </section>:null}

    {!loading&&arena.status==="AI_PREPARING"?<section className="mx-auto mt-6 max-w-2xl rounded-2xl border border-indigo-200 bg-white p-10 text-center" role="status">
      <Bot className="mx-auto size-10 text-indigo-600"/>
      <h2 className="mt-4 text-xl font-semibold text-slate-900">Preparing your AI practice round</h2>
      <p className="mt-2 text-sm text-slate-600">An AI is independently answering the quiz. If the model is unavailable, you will still receive a Solo Practice quiz.</p>
      <LoaderCircle className="mx-auto mt-4 size-5 animate-spin text-indigo-600"/>
    </section>:null}

    {!loading&&playing&&"questionNumber" in arena?<section className="mx-auto mt-6 max-w-3xl space-y-4" aria-live="polite">
      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-white p-4 sm:gap-4 sm:p-6">
        <div><p className="text-xs text-slate-500">You</p><p className="mt-1 text-sm font-semibold text-indigo-700">Player 1</p></div>
        <div className="text-center"><Swords className="mx-auto size-6 text-slate-500"/><p className="mt-1 text-[11px] text-slate-500">{isSolo?"SOLO PRACTICE":isAi?"AI CHALLENGE":"LIVE DUEL"}</p></div>
        <div className="text-right"><p className="text-xs text-slate-500">Opponent</p><p className="mt-1 text-sm font-semibold text-slate-800">{isSolo?"Solo practice":isAi?"AI Opponent":"Random rival"}</p></div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
            {ARENA_LABELS[arena.topic]} · Question {arena.questionNumber}/{arena.totalQuestions}
          </span>
          <span className={"inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold "+
            (arena.secondsRemaining<=7?"bg-amber-100 text-amber-800":"bg-slate-100 text-slate-700")}>
            <Clock3 className="size-3.5"/>{arena.secondsRemaining}s left
          </span>
        </div>
        <div className="mt-3 flex gap-1.5">
          {[1,2,3,4,5].map(i=><div key={i} className={"h-1.5 flex-1 rounded-full "+(i<=arena.questionNumber?"bg-indigo-500":"bg-slate-100")}/>)}
        </div>
        <h2 className="mt-7 text-xl font-semibold leading-8 text-slate-900">{arena.question}</h2>
        <div className="mt-5 grid gap-3">
          {arena.options.map((answerText,index)=>{
            const chosen=picked===index;
            return <button key={index} type="button"
              disabled={arena.answered||answering||arena.secondsRemaining===0}
              onClick={()=>void answer(index)}
              className={"flex items-center gap-3 rounded-xl border px-4 py-4 text-left text-sm transition disabled:cursor-not-allowed "+
                (chosen?"border-indigo-500 bg-indigo-50 font-semibold text-indigo-800":
                  "border-slate-200 text-slate-700 enabled:hover:border-indigo-300 enabled:hover:bg-slate-50")}>
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold">
                {String.fromCharCode(65+index)}
              </span>
              {answerText}
              {chosen?<CheckCircle2 className="ml-auto size-4 text-indigo-600"/>:null}
            </button>;
          })}
        </div>
        <div className="mt-5 flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
          <span>{arena.answered?"Answer locked.":"Submit one answer before time expires."}</span>
          <span>{isSolo?"Practice at your pace.":isAi?"AI answers are locked privately.":"rivalAnswered" in arena && arena.rivalAnswered?"Your rival answered.":"Your rival is thinking…"}</span>
        </div>
      </div>
      <p className="text-center text-xs text-slate-500">Answers are locked on the server. No chat or answers are shared during live questions.</p>
    </section>:null}

    {!loading&&finished&&"myScore" in arena?<section className="mx-auto mt-6 max-w-2xl rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm sm:p-10">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-amber-50"><Trophy className="size-8 text-amber-600"/></div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-indigo-600">{ARENA_LABELS[arena.topic]} · Match complete</p>
      <h2 className="mt-2 text-3xl font-semibold text-slate-900">
        {isSolo?"Solo practice complete":"outcome" in arena && arena.outcome==="WIN"?"You won the duel!":"outcome" in arena && arena.outcome==="LOSS"?(isAi?"AI Opponent wins this round":"Your rival wins this round"):"It's a tie!"}
      </h2>
      {isSolo?<div className="mt-7 rounded-xl bg-slate-50 p-5">
        <p className="text-xs text-slate-500">Solo practice score</p>
        <p className="mt-1 text-4xl font-bold text-indigo-600">{arena.myScore}/5</p>
      </div>:<div className="mt-7 grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-xl bg-slate-50 p-5">
        <div><p className="text-xs text-slate-500">You</p><p className="mt-1 text-3xl font-bold text-indigo-600">{arena.myScore}</p></div>
        <span className="text-sm text-slate-400">vs</span>
        <div><p className="text-xs text-slate-500">{isAi?"AI Opponent":"Random rival"}</p><p className="mt-1 text-3xl font-bold text-slate-800">{"rivalScore" in arena?arena.rivalScore:0}</p></div>
      </div>}
      <p className="mt-4 text-xs leading-6 text-slate-500">
        Score out of {arena.totalQuestions}. This was a casual practice match; no validated skill or career-readiness scores were modified.
      </p>
      <button type="button" onClick={()=>void changeQueue("find")} disabled={busy}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
        {busy?<LoaderCircle className="size-4 animate-spin"/>:<RefreshCw className="size-4"/>} Find another rival
      </button>
    </section>:null}
  </main>;
}
