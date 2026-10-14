"use client";
import {useState} from "react";
import Link from "next/link";
import { SparksActionPrice } from "@/components/sparks/sparks-action-price";
import {
  ArrowRight, BookOpenCheck, CheckCircle2, ChevronRight,
  FileCode2, GitCommitHorizontal, Github, LoaderCircle,
  LockKeyhole, SearchCode, ShieldAlert, Sparkles
} from "lucide-react";
import type {DefenseSnapshot} from "@/lib/domain/project-defense";
import type {ProjectDefenseReview} from "@/lib/services/projects/project-defense-service";

type Phase="IDLE"|"INSPECTING"|"READY"|"EVALUATING"|"COMPLETE";
type Response<T>={ok:boolean;data?:T;error?:{message?:string}};
const cls="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-50";

export function ProjectDefenseWorkbench(){
  const [url,setUrl]=useState("");
  const [phase,setPhase]=useState<Phase>("IDLE");
  const [snapshot,setSnapshot]=useState<DefenseSnapshot|null>(null);
  const [answers,setAnswers]=useState<Record<string,string>>({});
  const [review,setReview]=useState<ProjectDefenseReview|null>(null);
  const [aiUnavailable,setAiUnavailable]=useState(false);
  const [error,setError]=useState("");
  const [questionIndex,setQuestionIndex]=useState(0);
  async function inspect(){
    if(phase==="INSPECTING"||phase==="EVALUATING")return;
    setPhase("INSPECTING");setError("");setReview(null);setSnapshot(null);setAiUnavailable(false);
    try{
      const response=await fetch("/api/project-defense/inspect",{
        method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",
        body:JSON.stringify({repoUrl:url.trim()})
      });
      const payload=await response.json() as Response<DefenseSnapshot>;
      if(!response.ok||!payload.ok||!payload.data)throw new Error(payload.error?.message||"Unable to inspect repository.");
      setSnapshot(payload.data);setPhase("READY");setQuestionIndex(0);setAnswers({});
    }catch(e){
      setPhase("IDLE");setError(e instanceof Error?e.message:"Unable to inspect repository.");
    }
  }
  async function evaluate(){
    if(!snapshot||phase!=="READY")return;
    setPhase("EVALUATING");setError("");
    try{
      const result=await fetch("/api/project-defense/evaluate",{
        method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",
        body:JSON.stringify({repoUrl:url.trim(),commitSha:snapshot.commitSha,
          operationId:crypto.randomUUID(),
          answers:snapshot.questions.map(q=>({questionId:q.id,answer:answers[q.id]??""}))})
      });
      const payload=await result.json() as Response<{review:ProjectDefenseReview|null;status:string}>;
      if(!result.ok||!payload.ok||!payload.data)throw new Error(payload.error?.message||"Unable to evaluate answers.");
      setReview(payload.data.review);setAiUnavailable(payload.data.status==="AI_UNAVAILABLE");
      setPhase("COMPLETE");
    }catch(e){
      setPhase("READY");setError(e instanceof Error?e.message:"Evaluation unavailable.");
    }
  }
  const current=snapshot?.questions[questionIndex];
  const allAnswered=Boolean(snapshot?.questions.every(q=>(answers[q.id]??"").trim().length>=40));
  return (
    <div className="mt-6 space-y-6">
      <header className="max-w-3xl">
        <p className="eyebrow">SkillTwin · Agentic Project Defense pilot</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
          Don't just claim a skill. Explain your code.
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Link a public GitHub project. SkillTwin inspects three small source files,
          asks questions grounded in that exact commit, and reviews your reasoning.
          Source code can demonstrate design, but cannot establish who wrote it.
        </p>
      </header>
      <section className="grid gap-3 sm:grid-cols-3" aria-label="Project defense process">
        {[
          {icon:Github,title:"1. Inspect",text:"Pin and cite public code"},
          {icon:BookOpenCheck,title:"2. Defend",text:"Answer three grounded questions"},
          {icon:ShieldAlert,title:"3. Review",text:"Get provisional rubric feedback"}
        ].map(item=><div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-4">
          <item.icon className="size-5 text-brand-600"/>
          <p className="mt-2 text-sm font-semibold text-slate-900">{item.title}</p>
          <p className="mt-1 text-xs text-slate-600">{item.text}</p>
        </div>)}
      </section>
      <section className="surface-card p-5 sm:p-6" aria-label="Inspect a public GitHub project">
        <label htmlFor="defense-repo-url" className="text-sm font-semibold text-slate-900">
          Public GitHub repository
        </label>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Public repositories only. No access token, cloning, code execution or private file uploads.
        </p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input id="defense-repo-url" type="url" autoComplete="url" value={url}
            onChange={e=>setUrl(e.target.value)} placeholder="https://github.com/owner/repository"
            className={cls} disabled={phase==="INSPECTING"||phase==="EVALUATING"}/>
          <button type="button" className="btn-primary shrink-0 justify-center"
            disabled={!url.trim()||phase==="INSPECTING"||phase==="EVALUATING"}
            onClick={()=>void inspect()}>
            {phase==="INSPECTING"?<LoaderCircle className="size-4 animate-spin"/>:<SearchCode className="size-4"/>}
            {phase==="INSPECTING"?"Inspecting code":"Inspect project"}
          </button>
        </div>
        {snapshot? <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <GitCommitHorizontal className="size-4 text-brand-600"/>
          {snapshot.repository} · Commit <code>{snapshot.commitSha.slice(0,10)}</code> · {snapshot.sourceCount} source files
        </p>:null}
      </section>
      {error?<p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>:null}
      {snapshot && current?(
        <section className="grid gap-5 lg:grid-cols-[1fr_1.05fr]" aria-label="Source-grounded defense interview">
          <div className="surface-card overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <FileCode2 className="size-4"/> Source excerpt · Question {questionIndex+1} of 3
              </p>
              <a href={current.sourceUrl} target="_blank" rel="noopener noreferrer"
                className="quiet-link mt-2 inline-flex items-center gap-1 text-sm break-all">
                {current.path} · L{current.startLine}–{current.endLine} <ArrowRight className="size-3.5"/>
              </a>
            </div>
            <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap break-words bg-slate-950 p-5 font-mono text-xs leading-6 text-slate-100">
              {snapshot.sources[questionIndex]?.excerpt??""}
            </pre>
            <p className="px-5 py-3 text-xs leading-5 text-slate-500">
              The excerpt is untrusted project code shown for reference, not executed.
              Only selected lines were inspected; unseen files were not reviewed.
            </p>
          </div>
          <div className="surface-card p-5 sm:p-6">
            <div className="mb-4 flex gap-2" aria-label="Question navigation">
              {snapshot.questions.map((q,i)=><button type="button" key={q.id}
                onClick={()=>setQuestionIndex(i)}
                aria-label={"Question "+(i+1)}
                aria-current={i===questionIndex?"step":undefined}
                className={"flex-1 rounded-lg border px-2 py-2 text-xs font-semibold transition "+
                  (i===questionIndex?"border-brand-400 bg-brand-50 text-brand-700":"border-slate-200 bg-white text-slate-600 hover:border-brand-200")}>
                {i+1}{(answers[q.id]??"").trim().length>=40?" ✓":""}
              </button>)}
            </div>
            <p className="eyebrow">Engineering interview</p>
            <h2 className="mt-2 text-lg font-semibold leading-7 text-slate-900">{current.prompt}</h2>
            <div className="mt-4 rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">What an explanation should cover</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-slate-600">
                {current.rubric.map(r=><li key={r}>{r}</li>)}
              </ul>
            </div>
            <label htmlFor="defense-answer" className="mt-5 block text-sm font-semibold text-slate-900">Your explanation</label>
            <textarea id="defense-answer" rows={7} className={cls+" mt-2 resize-y"}
              disabled={phase==="EVALUATING"||phase==="COMPLETE"}
              value={answers[current.id]??""} maxLength={4000}
              onChange={e=>setAnswers(prev=>({...prev,[current.id]:e.target.value}))}
              placeholder="Point to the actual code, explain why it works, and identify what you would test…"/>
            <p className="mt-2 text-xs text-slate-500">
              {(answers[current.id]??"").trim().length} characters · 40 minimum per question. Your explanation is not proof of authorship.
            </p>
            <SparksActionPrice action="PROJECT_DEFENSE" label="Evaluate your project defense" />
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {questionIndex<2?<button type="button" className="btn-secondary"
                onClick={()=>setQuestionIndex(i=>Math.min(2,i+1))}>Next question <ChevronRight className="size-4"/></button>:null}
              <button type="button" className="btn-primary" onClick={()=>void evaluate()}
                disabled={!allAnswered||phase==="EVALUATING"||phase==="COMPLETE"}>
                {phase==="EVALUATING"?<LoaderCircle className="size-4 animate-spin"/>:<Sparkles className="size-4"/>}
                {phase==="EVALUATING"?"Reviewing explanations":"Evaluate all three answers"}
              </button>
            </div>
          </div>
        </section>
      ):null}
      {phase==="COMPLETE"&&snapshot?(
        <section className="surface-card p-5 sm:p-6" aria-label="Provisional project defense results">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
            <CheckCircle2 className="size-5 text-brand-600"/> Interview review
          </h2>
          {aiUnavailable?<p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            The AI evaluator is unavailable. We have not fabricated a score or competence judgment.
            The source-linked interview questions remain available to review.
          </p>:null}
          <div className="mt-4 grid gap-3">
            {review?.reviews.map((r,i)=><article key={r.questionId} className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-brand-700">Question {i+1} · {r.demonstratedUnderstanding.replaceAll("_"," ")}</p>
              <p className="mt-2 text-sm leading-6 text-slate-800">{r.explanation}</p>
              <p className="mt-2 text-xs leading-6 text-slate-600"><strong>Follow-up:</strong> {r.nextQuestion}</p>
              <a href={snapshot.questions[i].sourceUrl} target="_blank" rel="noopener noreferrer"
                className="quiet-link mt-2 inline-flex items-center gap-1 text-xs">Inspect cited code <ArrowRight className="size-3"/></a>
            </article>)}
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <LockKeyhole className="mt-0.5 size-5 shrink-0 text-slate-500"/>
            <p className="text-xs leading-6 text-slate-600">
              This pilot review is provisional and stays in this browser session. It is not a
              verified assessment, does not prove code authorship, is not saved to your evidence passport,
              and cannot change your skill scores or roadmap.
            </p>
          </div>
          <Link href="/challenge-my-twin" className="btn-secondary mt-4">
            Continue with a validated skill challenge <ArrowRight className="size-4"/>
          </Link>
        </section>
      ):null}
    </div>
  );
}
