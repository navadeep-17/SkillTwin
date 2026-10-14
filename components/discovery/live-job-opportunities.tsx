"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, BriefcaseBusiness, Clock3, ExternalLink, LoaderCircle, RefreshCcw, Search, ShieldCheck } from "lucide-react";

type Job = {
  id:string; title:string; company:string; url:string;
  region:string; level:string|null; employmentType:string|null; publishedAt:string;
  excerpt:string; source:"Jobicy";
  signals:{role:string;knownSkills:string[];exploreNext:string[];seniorRole:boolean};
};
type Filters={q:string;region:"all"|"anywhere"|"apac"|"india";hideSenior:boolean};
type Payload={ok:boolean;data?:{
  jobs:Job[];available:boolean;roleUsed:string;basedOnActiveGoal:boolean;recordedSkillCount:number;
  source:{name:string;url:string;coverage:string;sourceUpdatedAt:string|null;refreshIntervalMinutes:number};
  disclaimer:string;
};error?:{message?:string}};
const initial:Filters={q:"",region:"all",hideSenior:true};

function posted(value:string):string {
  const time=Date.parse(value);
  if(!Number.isFinite(time))return "Date unavailable";
  const days=Math.max(0,Math.floor((Date.now()-time)/86400000));
  return days===0?"Posted today":days===1?"Posted yesterday":"Posted "+days+" days ago";
}

export function LiveJobOpportunities() {
  const [text,setText]=useState("");
  const [region,setRegion]=useState<Filters["region"]>("all");
  const [hideSenior,setHideSenior]=useState(true);
  const [applied,setApplied]=useState<Filters>(initial);
  const [refresh,setRefresh]=useState(0);
  const [payload,setPayload]=useState<Payload|null>(null);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    const controller=new AbortController();
    async function load(){
      setLoading(true);
      try{
        const query=new URLSearchParams({
          region:applied.region,
          hideSenior:String(applied.hideSenior)
        });
        if(applied.q)query.set("q",applied.q);
        const response=await fetch("/api/jobs/recommendations?"+query.toString(),{
          cache:"no-store",signal:controller.signal
        });
        const value:Payload=await response.json();
        if(!response.ok||!value.ok)throw new Error(value.error?.message??"Could not load vacancies");
        if(!controller.signal.aborted)setPayload(value);
      }catch(error){
        if(!controller.signal.aborted)setPayload({
          ok:false,error:{message:error instanceof Error?error.message:"Unable to load vacancies"}
        });
      }finally{
        if(!controller.signal.aborted)setLoading(false);
      }
    }
    void load();
    return ()=>controller.abort();
  },[applied,refresh]);

  const data=payload?.data;

  return (
    <section id="live-opportunities" aria-labelledby="jobs-heading" className="surface-card mt-8 scroll-mt-20 overflow-hidden">
      <div className="border-b border-blue-100 bg-gradient-to-r from-blue-50 via-white to-white px-5 py-5 sm:px-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-700">
              <BriefcaseBusiness aria-hidden="true" className="size-3.5"/> Live-source opportunities
            </span>
            <h2 id="jobs-heading" className="mt-2 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">
              Jobs related to your learning goal
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Recent remote vacancies from a published job feed, ranked against your selected career and recorded skills. These are leads to review, not confirmed eligibility.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200">
            <Clock3 aria-hidden="true" className="size-3.5"/> Provider feed · hourly cache
          </span>
        </div>
      </div>
      <div className="p-5 sm:p-7">
        <form onSubmit={event=>{
          event.preventDefault();
          setApplied({q:text.trim().slice(0,75),region,hideSenior});
        }} className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] md:items-end">
          <label className="block min-w-0">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">Role to explore</span>
            <span className="relative block">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400"/>
              <input value={text} onChange={e=>setText(e.target.value)} maxLength={75}
                placeholder="Your active goal (or type a role)"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-blue-500"/>
            </span>
          </label>
          <label className="block min-w-0">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">Remote hiring region</span>
            <select value={region} onChange={e=>setRegion(e.target.value as Filters["region"])}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500">
              <option value="all">All regions (check eligibility)</option>
              <option value="anywhere">Global / anywhere only</option>
              <option value="apac">APAC or globally listed</option>
              <option value="india">India or globally listed</option>
            </select>
          </label>
          <button type="submit" disabled={loading}
            className="btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-60">
            <Search aria-hidden="true" className="size-4"/> Find jobs
          </button>
        </form>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-700">
            <input type="checkbox" checked={hideSenior} onChange={e=>{
              const enabled=e.target.checked;
              setHideSenior(enabled);
              setApplied(old=>({...old,hideSenior:enabled}));
            }} className="size-4 accent-blue-700"/>
            Hide clearly senior/lead positions
          </label>
          <button type="button" disabled={loading} onClick={()=>setRefresh(x=>x+1)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline disabled:opacity-50">
            <RefreshCcw aria-hidden="true" className="size-3.5"/> Refresh results
          </button>
        </div>

        {loading ? (
          <div role="status" className="mt-6 flex items-center gap-2 rounded-xl bg-slate-50 p-5 text-sm text-slate-600">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin"/> Checking the latest cached job listings…
          </div>
        ) : !payload?.ok ? (
          <div role="alert" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-semibold text-amber-950">Job recommendations could not load.</p>
            <p className="mt-1 text-sm text-amber-800">{payload?.error?.message??"Try again shortly."}</p>
          </div>
        ) : !data?.available ? (
          <div role="status" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-semibold text-amber-950">Live listings are temporarily unavailable.</p>
            <p className="mt-1 text-sm text-amber-800">SkillTwin won’t substitute example jobs or stale fabricated vacancies.</p>
            <a className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:underline"
              href="https://jobicy.com/" target="_blank" rel="noopener noreferrer">Browse the source directly <ExternalLink aria-hidden="true" className="size-4"/></a>
          </div>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <ShieldCheck aria-hidden="true" className="size-4 text-blue-700"/>
                <span>Exploring: <strong className="text-slate-900">{data.roleUsed}</strong></span>
                {!data.basedOnActiveGoal && !applied.q ? <span className="text-xs text-slate-500">(starter query)</span> : null}
              </div>
              <span className="text-xs text-slate-500">{data.jobs.length} relevant {data.jobs.length===1?"listing":"listings"} · source: Jobicy</span>
            </div>
            {data.jobs.length ? (
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {data.jobs.map(job=>(
                  <article key={job.id} className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-slate-900">{job.title}</h3>
                        <p className="mt-1 text-sm text-slate-600">{job.company}</p>
                      </div>
                      <span className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-800">Jobicy</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-600">
                      <span className="rounded-md bg-slate-100 px-2 py-1">{job.region}</span>
                      {job.level ? <span className="rounded-md bg-slate-100 px-2 py-1">{job.level}</span> : null}
                      {job.employmentType ? <span className="rounded-md bg-slate-100 px-2 py-1">{job.employmentType}</span> : null}
                      <span className="rounded-md bg-slate-100 px-2 py-1">{posted(job.publishedAt)}</span>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-600">{job.signals.role}</p>
                    {job.excerpt ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{job.excerpt}</p> : null}
                    {job.signals.knownSkills.length ? (
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <span className="mr-1 text-[11px] font-medium text-slate-500">In your profile:</span>
                        {job.signals.knownSkills.map(skill=><span key={skill} className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">{skill}</span>)}
                      </div>
                    ) : null}
                    {job.signals.exploreNext.length ? (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="mr-1 text-[11px] font-medium text-slate-500">Keywords to explore:</span>
                        {job.signals.exploreNext.map(skill=><span key={skill} className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">{skill}</span>)}
                      </div>
                    ) : null}
                    <a href={job.url} target="_blank" rel="noopener noreferrer"
                      className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-semibold text-blue-700 hover:underline">
                      View original posting <ArrowUpRight aria-hidden="true" className="size-4"/>
                    </a>
                  </article>
                ))}
              </div>
            ) : (
              <div role="status" className="mt-5 rounded-xl bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-800">No closely matching roles in this feed right now.</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Try a broader job title, another region, or untick the senior-role filter.
                  This provider does not include every employer or local/campus vacancy.
                </p>
              </div>
            )}
            <div className="mt-5 border-t border-slate-100 pt-4 text-xs leading-6 text-slate-500">
              <p>Job data: <a className="font-semibold text-blue-700 hover:underline" target="_blank" rel="noopener noreferrer" href={data.source.url}>Jobicy public API <ExternalLink aria-hidden="true" className="inline size-3"/></a>
                {data.source.sourceUpdatedAt ? " · Source update: "+new Date(data.source.sourceUpdatedAt).toLocaleString(): ""}
                {" · "}Refreshable approximately hourly; individual postings can close between checks.</p>
              <p className="mt-1">{data.disclaimer} Keyword mentions are not necessarily mandatory skills. Regional filters do not verify an individual applicant's hiring eligibility.</p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
