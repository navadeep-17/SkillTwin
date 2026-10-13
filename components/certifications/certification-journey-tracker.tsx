"use client";

import {useState} from "react";
import Link from "next/link";
import {
  Award,ArrowLeft,ArrowRight,BookOpen,CalendarDays,Check,CheckCircle2,
  ExternalLink,LoaderCircle,ShieldAlert,Trash2
} from "lucide-react";
import {certificationById} from "@/lib/domain/certification-catalog";
import {progressPercent,type CertificationJourney} from "@/lib/domain/certification-journey";
import {buildCertificationPreparationPlan} from "@/lib/domain/certification-preparation";
import type {CertificationMatch} from "@/lib/domain/certification-recommender";
import {CertificationPreparationCard} from "./certification-preparation-card";

type Props={initialGoals:CertificationJourney[];certificationMatches:CertificationMatch[]};
const statusText:Record<CertificationJourney["status"],string>={
  SAVED:"Saved for later",PREPARING:"Preparing",EXAM_PLANNED:"Exam target planned",
  EARNED_SELF_REPORTED:"Earned · Self-reported"
};
type Edit={action:"START_PREPARATION"}|
  {action:"TOGGLE_TOPIC";topic:string}|
  {action:"SET_EXAM_TARGET";targetExamDate:string}|
  {action:"REPORT_EARNED";earnedDate:string;credentialUrl:string};

export function CertificationJourneyTracker({initialGoals,certificationMatches}:Props){
  const [goals,setGoals]=useState(initialGoals);
  const [busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [examDates,setExamDates]=useState<Record<string,string>>({});
  const [earnedDates,setEarnedDates]=useState<Record<string,string>>({});
  const [credentialUrls,setCredentialUrls]=useState<Record<string,string>>({});
  const [showProof,setShowProof]=useState<string|null>(null);
  const [showExam,setShowExam]=useState<string|null>(null);

  async function change(goal:CertificationJourney,edit:Edit){
    if(busy)return;
    setBusy(goal.id);setError(null);
    try{
      const response=await fetch("/api/certifications/journey/"+encodeURIComponent(goal.id),{
        method:"PATCH",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({...edit,expectedVersion:goal.version})
      });
      const result=await response.json();
      if(!response.ok||!result.ok)
        throw new Error(result.error?.message??"Could not update this certification.");
      setGoals(old=>old.map(item=>item.id===goal.id?result.data.goal:item));
      if(edit.action==="REPORT_EARNED")setShowProof(null);
      if(edit.action==="SET_EXAM_TARGET")setShowExam(null);
    }catch(err){
      setError(err instanceof Error?err.message:"Could not update the certification.");
    }finally{setBusy(null)}
  }
  async function remove(goal:CertificationJourney){
    if(busy||!window.confirm("Remove this certification from your journey? Your preparation checklist will be lost."))return;
    setBusy(goal.id);setError(null);
    try{
      const response=await fetch("/api/certifications/journey/"+encodeURIComponent(goal.id),{
        method:"DELETE",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({expectedVersion:goal.version})
      });
      const result=await response.json();
      if(!response.ok||!result.ok)
        throw new Error(result.error?.message??"Could not remove this certification.");
      setGoals(old=>old.filter(item=>item.id!==goal.id));
    }catch(err){
      setError(err instanceof Error?err.message:"Could not remove the certification.");
    }finally{setBusy(null)}
  }

  return <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
    <Link href="/certifications" className="quiet-link inline-flex items-center gap-2 text-sm">
      <ArrowLeft className="size-4"/> All certifications
    </Link>
    <header className="mt-5 rounded-[28px] bg-slate-950 px-6 py-8 text-white sm:px-10">
      <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-indigo-200">
        <Award className="size-4"/> My Certification Journey
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        Build skills. Prepare. Track your proof.
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
        Your preparation checklist lives here across sessions. Dates are goals, not exam bookings.
        Any earned credential stays self-reported unless independently verified by its issuer.
      </p>
      <div className="mt-5 flex flex-wrap gap-3 text-xs text-slate-200">
        <span className="rounded-full bg-white/10 px-3 py-1.5">{goals.length} saved</span>
        <span className="rounded-full bg-white/10 px-3 py-1.5">
          {goals.filter(g=>g.status==="PREPARING"||g.status==="EXAM_PLANNED").length} preparing / planned
        </span>
        <span className="rounded-full bg-white/10 px-3 py-1.5">
          {goals.filter(g=>g.status==="EARNED_SELF_REPORTED").length} self-reported earned
        </span>
      </div>
    </header>
    {error?<div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      {error} <button type="button" onClick={()=>window.location.reload()} className="ml-2 underline">Refresh journey</button>
    </div>:null}
    {!goals.length?<section className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <BookOpen className="mx-auto size-8 text-indigo-600"/>
      <h2 className="mt-4 text-lg font-semibold">Your journey starts with one credential</h2>
      <p className="mt-2 text-sm text-slate-600">
        Explore issuer credentials and save one that makes sense for your role and current skill gaps.
      </p>
      <Link href="/certifications" className="btn-primary mt-5 inline-flex items-center gap-2">
        Explore certifications <ArrowRight className="size-4"/>
      </Link>
    </section>:null}
    <div className="mt-6 space-y-5">
      {goals.map(goal=>{
        const cert=certificationById(goal.certification_id);
        if(!cert)return null;
        const progress=progressPercent(goal);
        const match=certificationMatches.find(m=>m.certification.id===goal.certification_id);
        const preparation=buildCertificationPreparationPlan(goal,match);
        const saving=busy===goal.id;
        const earned=goal.status==="EARNED_SELF_REPORTED";
        return <section key={goal.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-5 sm:p-6">
            <div className="flex min-w-0 items-start gap-3">
              <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600"><Award className="size-5"/></div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{cert.issuer} · {cert.level}</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">{cert.title}</h2>
                <span className="mt-2 inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                  {statusText[goal.status]}
                </span>
              </div>
            </div>
            <button type="button" disabled={Boolean(busy)} onClick={()=>void remove(goal)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-slate-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50">
              <Trash2 className="size-3.5"/> Remove
            </button>
          </div>
          <div className="space-y-5 p-5 sm:p-6">
            {preparation?<CertificationPreparationCard plan={preparation}/>:null}
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-800">Preparation topics</span>
                <span className="font-semibold text-indigo-600">{progress}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar"
                aria-label={"Preparation progress for "+cert.title}
                aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-indigo-500 transition-all" style={{width:progress+"%"}}/>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Checklist progress is self-reported study activity—not exam readiness or independently assessed knowledge.
              </p>
            </div>
            {goal.status==="SAVED"?
              <button type="button" disabled={Boolean(busy)}
                onClick={()=>void change(goal,{action:"START_PREPARATION"})}
                className="btn-primary inline-flex items-center gap-2">
                {saving?<LoaderCircle className="size-4 animate-spin"/>:<BookOpen className="size-4"/>}
                Start preparation
              </button>:null}
            {goal.status!=="SAVED"?<fieldset disabled={Boolean(busy)||earned}>
              <legend className="mb-3 text-sm font-semibold text-slate-800">Syllabus study checklist</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {cert.topics.map(topic=>{
                  const checked=goal.completed_topics.includes(topic);
                  return <label key={topic}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm text-slate-700 hover:border-indigo-200">
                    <input type="checkbox" checked={checked}
                      onChange={()=>void change(goal,{action:"TOGGLE_TOPIC",topic})}
                      className="mt-1 accent-indigo-600"/>
                    <span>{topic}</span>
                    {checked?<Check className="ml-auto size-4 shrink-0 text-indigo-600"/>:null}
                  </label>;
                })}
              </div>
            </fieldset>:null}
            {goal.status==="EXAM_PLANNED"&&goal.target_exam_date?
              <p className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <CalendarDays className="size-4"/> Exam target: {goal.target_exam_date} (not an issuer booking)
              </p>:null}
            {!earned&&goal.status!=="SAVED"?<div className="flex flex-wrap gap-2">
              <button type="button" disabled={Boolean(busy)}
                onClick={()=>setShowExam(value=>value===goal.id?null:goal.id)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                {goal.status==="EXAM_PLANNED"?"Change exam target":"Set a target exam date"}
              </button>
              <button type="button" disabled={Boolean(busy)}
                onClick={()=>setShowProof(value=>value===goal.id?null:goal.id)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                Report earned credential
              </button>
              {goal.status==="EXAM_PLANNED"?
                <button type="button" disabled={Boolean(busy)}
                  onClick={()=>void change(goal,{action:"START_PREPARATION"})}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  Return to preparation
                </button>:null}
            </div>:null}
            {showExam===goal.id&&!earned?<form className="flex flex-wrap items-end gap-2 rounded-xl bg-slate-50 p-3"
              onSubmit={event=>{event.preventDefault();void change(goal,{
                action:"SET_EXAM_TARGET",targetExamDate:examDates[goal.id]??""
              });}}>
              <label className="text-xs font-semibold text-slate-700">Planned exam target
                <input type="date" required value={examDates[goal.id]??""}
                  min={new Date().toISOString().slice(0,10)}
                  onChange={event=>setExamDates(old=>({...old,[goal.id]:event.target.value}))}
                  className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-2"/>
              </label>
              <button type="submit" disabled={Boolean(busy)}
                className="btn-primary px-4 py-2 text-xs">Save target</button>
              <p className="w-full text-xs text-slate-500">This is a study goal; exam booking stays on the issuer website.</p>
            </form>:null}
            {showProof===goal.id&&!earned?<form className="grid gap-3 rounded-xl bg-slate-50 p-4"
              onSubmit={event=>{event.preventDefault();void change(goal,{
                action:"REPORT_EARNED",earnedDate:earnedDates[goal.id]??"",
                credentialUrl:credentialUrls[goal.id]??""
              });}}>
              <h3 className="text-sm font-semibold text-slate-800">Record a self-reported credential</h3>
              <label className="text-xs font-semibold text-slate-700">Date earned
                <input type="date" required max={new Date().toISOString().slice(0,10)}
                  value={earnedDates[goal.id]??""} onChange={event=>
                    setEarnedDates(old=>({...old,[goal.id]:event.target.value}))}
                  className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2"/>
              </label>
              <label className="text-xs font-semibold text-slate-700">Issuer credential link (optional)
                <input type="url" placeholder="https://..." value={credentialUrls[goal.id]??""}
                  onChange={event=>setCredentialUrls(old=>({...old,[goal.id]:event.target.value}))}
                  className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2"/>
              </label>
              <p className="text-xs text-slate-600">Submitting a link does not verify it with the issuer or increase your SkillTwin proficiency scores.</p>
              <button type="submit" disabled={Boolean(busy)}
                className="btn-primary inline-flex items-center justify-center gap-2">
                <CheckCircle2 className="size-4"/> Save as self-reported
              </button>
            </form>:null}
            {earned?<div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="flex items-start gap-2 text-sm font-semibold text-amber-900">
                <ShieldAlert className="mt-0.5 size-4 shrink-0"/> Self-reported · Not issuer-verified
              </p>
              <p className="mt-1 text-xs text-amber-800">
                Recorded earned date: {goal.earned_date??"Unknown"}.
                This claim has not been authenticated by SkillTwin or the credential issuer.
              </p>
              {goal.credential_url?<a href={goal.credential_url} target="_blank" rel="noopener noreferrer nofollow"
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-900 underline">
                View submitted credential link <ExternalLink className="size-3.5"/>
              </a>:null}
            </div>:null}
            <a href={cert.officialUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 hover:underline">
              Official issuer preparation and exam information <ExternalLink className="size-4"/>
            </a>
          </div>
        </section>;
      })}
    </div>
  </main>;
}
