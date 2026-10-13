"use client";

import {useMemo,useState} from "react";
import Link from "next/link";
import {
  Award,ArrowRight,BookOpen,CheckCircle2,ChevronRight,Compass,
  ExternalLink,Filter,GraduationCap,Info,Search,ShieldCheck,Sparkles,Target
} from "lucide-react";
import type {CertificationMatch} from "@/lib/domain/certification-recommender";
import type {CertificationTrack} from "@/lib/domain/certification-catalog";

type Mode="recommended"|"all";
type Props={goalName:string|null;hasGapSnapshot:boolean;matches:CertificationMatch[]};
const trackOptions:(CertificationTrack|"All tracks")[]=[
  "All tracks","Cloud","Developer Tools","Cybersecurity","Networking","Data"
];
const badges:Record<CertificationMatch["alignment"],string>={
  ROLE_AND_GAP:"Goal + gap match",
  GOAL_MATCH:"Goal-aligned",
  GAP_MATCH:"Gap-related",
  EXPLORE:"Explore"
};
const names:Record<string,string>={
  cloud:"Cloud Fundamentals",git:"Git",linux:"Linux",authentication:"Authentication",
  "system-design":"System Design",testing:"Testing",python:"Python",sql:"SQL",
  pandas:"Pandas","power-bi":"Power BI","data-visualization":"Data Visualization",excel:"Spreadsheets"
};
const skillName=(slug:string)=>names[slug]??slug.replaceAll("-"," ");
function trackCount(matches:CertificationMatch[]){
  return new Set(matches.map(match=>match.certification.track)).size;
}

export function CertificationExplorer({goalName,hasGapSnapshot,matches}:Props){
  const [mode,setMode]=useState<Mode>("recommended");
  const [query,setQuery]=useState("");
  const [track,setTrack]=useState<CertificationTrack|"All tracks">("All tracks");
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const availableRecommended=matches.some(m=>m.alignment!=="EXPLORE");
  const filtered=useMemo(()=>matches.filter(match=>{
    if(mode==="recommended"&&match.alignment==="EXPLORE")return false;
    if(track!=="All tracks"&&match.certification.track!==track)return false;
    if(query.trim()){
      const haystack=[
        match.certification.title,match.certification.issuer,
        match.certification.track,match.certification.description,
        ...match.certification.skills,...match.certification.topics
      ].join(" ").toLowerCase();
      if(!haystack.includes(query.trim().toLowerCase()))return false;
    }
    return true;
  }),[matches,mode,track,query]);
  const selected=filtered.find(m=>m.certification.id===selectedId)??filtered[0]??null;
  return (
    <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <Link href="/overview" className="hover:text-brand-600">Home</Link>
        <ChevronRight className="size-3.5"/>
        <span className="font-semibold text-slate-700">Certifications</span>
      </div>
      <section className="relative overflow-hidden rounded-[28px] bg-slate-950 px-6 py-8 text-white shadow-xl shadow-slate-900/10 sm:px-10 sm:py-10">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-40 size-[360px] rounded-full bg-indigo-500/25 blur-[85px]"/>
        <div aria-hidden="true" className="pointer-events-none absolute bottom-0 right-20 size-48 rounded-full bg-sky-400/10 blur-[70px]"/>
        <div className="relative max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold tracking-widest text-indigo-100 uppercase">
            <Award className="size-3.5"/> SkillTwin Credentials
          </span>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
            Earn credentials that support your next move.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
            Explore reviewed issuer certifications. SkillTwin connects their topics to your career target,
            recorded skill gaps, and preparation evidence — without promising an exam result.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-4 text-sky-300"/> Official issuer destinations</span>
            <span className="inline-flex items-center gap-1.5"><BookOpen className="size-4 text-sky-300"/> {matches.length} curated programs</span>
            <span className="inline-flex items-center gap-1.5"><Compass className="size-4 text-sky-300"/> {trackCount(matches)} career tracks</span>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_300px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600"><Target className="size-5"/></div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Your career signal</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">
                {goalName??"Set a career goal to unlock tailored picks"}
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {goalName
                  ?hasGapSnapshot
                    ?"Suggestions are ranked by your active goal and its latest recorded skill-gap snapshot."
                    :"Your role can guide suggestions. Complete a skill-gap analysis for stronger matches."
                  :"Browse issuer certifications now, or select a target role for meaningful recommendations."}
              </p>
            </div>
          </div>
          {!goalName?<Link href="/onboarding" className="quiet-link mt-4 inline-flex items-center gap-1.5 text-sm">
            Set my goal <ArrowRight className="size-4"/>
          </Link>:null}
        </section>
        <section className="flex flex-col justify-center rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recommendation policy</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">Career fit ≠ exam readiness</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            A qualification may fit your goal without enough evidence to recommend booking the exam.
          </p>
        </section>
      </div>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-600">Find your next credential</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">The certification shortlist</h2>
          </div>
          <p className="text-xs text-slate-500">Issuer pages last reviewed 13 Oct 2026</p>
        </div>
        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex rounded-xl bg-slate-100 p-1">
            <button type="button" aria-pressed={mode==="recommended"}
              onClick={()=>{setMode("recommended");setSelectedId(null);}}
              className={"rounded-lg px-4 py-2 text-sm font-semibold transition "+
                (mode==="recommended"?"bg-white text-slate-950 shadow-sm":"text-slate-500 hover:text-slate-800")}>
              For you
            </button>
            <button type="button" aria-pressed={mode==="all"}
              onClick={()=>{setMode("all");setSelectedId(null);}}
              className={"rounded-lg px-4 py-2 text-sm font-semibold transition "+
                (mode==="all"?"bg-white text-slate-950 shadow-sm":"text-slate-500 hover:text-slate-800")}>
              Browse all
            </button>
          </div>
          <div className="flex flex-1 flex-wrap gap-2 sm:justify-end">
            <label className="relative min-w-[170px] flex-1 sm:max-w-[260px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"/>
              <span className="sr-only">Search certifications</span>
              <input type="search" value={query} onChange={event=>setQuery(event.target.value)}
                placeholder="Search credentials"
                className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"/>
            </label>
            <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5">
              <Filter className="size-4 text-slate-400"/>
              <span className="sr-only">Career track</span>
              <select value={track} onChange={event=>{setTrack(event.target.value as typeof track);setSelectedId(null);}}
                className="max-w-[190px] bg-transparent py-2.5 text-sm text-slate-700 outline-none">
                {trackOptions.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(290px,0.83fr)]">
          <div className="space-y-3">
            {mode==="recommended"&&!availableRecommended?(
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
                <Sparkles className="size-6 text-indigo-500"/>
                <h3 className="mt-3 font-semibold text-slate-900">No evidence-backed shortlist yet</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  We won’t label a credential as career-relevant without a matching role or gap.
                  Choose a role, collect evidence, or browse the reviewed catalog.
                </p>
                <button type="button" onClick={()=>{setMode("all");setSelectedId(null);}}
                  className="quiet-link mt-4 inline-flex items-center gap-1.5">
                  Browse all certifications <ArrowRight className="size-4"/>
                </button>
              </div>
            ):null}
            {filtered.map(match=>{
              const c=match.certification;
              const active=selected?.certification.id===c.id;
              return (
                <button type="button" key={c.id} onClick={()=>setSelectedId(c.id)}
                  aria-pressed={active}
                  className={"w-full rounded-2xl border p-4 text-left transition sm:p-5 "+
                    (active?"border-indigo-400 bg-indigo-50/45 shadow-[0_12px_40px_rgba(91,92,226,0.09)]":
                      "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm")}>
                  <div className="flex items-start gap-3">
                    <div className={"flex size-10 shrink-0 items-center justify-center rounded-xl "+
                      (active?"bg-indigo-600 text-white":"bg-slate-100 text-slate-600")}>
                      <Award className="size-5"/>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{c.issuer}</span>
                        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          {c.level}
                        </span>
                      </div>
                      <h3 className="mt-1.5 text-base font-semibold leading-6 text-slate-950">{c.title}</h3>
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{c.description}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {match.alignment!=="EXPLORE"?(
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
                            <CheckCircle2 className="size-3"/>{badges[match.alignment]}
                          </span>
                        ):(
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-500">{badges[match.alignment]}</span>
                        )}
                        <span className="text-xs text-slate-500">{c.track}</span>
                      </div>
                    </div>
                    <ChevronRight className={"mt-3 size-4 shrink-0 "+(active?"text-indigo-500":"text-slate-400")}/>
                  </div>
                </button>
              );
            })}
            {!filtered.length&&!(mode==="recommended"&&!availableRecommended)?(
              <p role="status" className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">
                Nothing matches these filters. Try another track or search term.
              </p>
            ):null}
          </div>

          <aside className="lg:sticky lg:top-20">
            {selected?(
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 bg-gradient-to-br from-slate-950 to-slate-800 p-5 text-white sm:p-6">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-indigo-200">
                    <GraduationCap className="size-4"/> Credential briefing
                  </div>
                  <h3 className="mt-3 text-xl font-semibold tracking-tight">{selected.certification.title}</h3>
                  <p className="mt-2 text-sm text-slate-300">{selected.certification.issuer} · {selected.certification.level}</p>
                </div>
                <div className="space-y-5 p-5 sm:p-6">
                  <section>
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                      <Target className="size-4 text-indigo-600"/> Why it appears here
                    </h4>
                    <div className="mt-2 space-y-2">
                      {selected.reasons.map(reason=><p key={reason} className="text-sm leading-6 text-slate-600">{reason}</p>)}
                    </div>
                  </section>
                  <div className="border-t border-slate-100 pt-4">
                    <h4 className="text-sm font-semibold text-slate-950">SkillTwin skill mapping</h4>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {selected.certification.skills.map(slug=>
                        <span key={slug} className={"rounded-lg px-2.5 py-1.5 text-xs font-medium "+
                          (selected.matchedGapSlugs.includes(slug)?"bg-indigo-100 text-indigo-700":"bg-slate-100 text-slate-700")}>
                          {skillName(slug)}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Approximate topic alignment, not an issuer-endorsed skill equivalence.
                    </p>
                  </div>
                  <section className="border-t border-slate-100 pt-4">
                    <h4 className="text-sm font-semibold text-slate-950">Before booking an exam</h4>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {selected.preparation==="FOUNDATION_FIRST"
                        ?"You have not yet documented some mapped prerequisite skills. Build and assess these foundations first."
                        :selected.preparation==="CHECK_ISSUER_SYLLABUS"
                          ?"You have some related learning evidence. Check the issuer's full syllabus and take its official practice assessment before deciding."
                          :"SkillTwin has insufficient validated evidence to estimate exam preparedness. Start with the issuer's published syllabus."}
                    </p>
                  </section>
                  <section className="border-t border-slate-100 pt-4">
                    <h4 className="text-sm font-semibold text-slate-950">Topics covered</h4>
                    <ul className="mt-2 space-y-2">
                      {selected.certification.topics.map(topic=>
                        <li key={topic} className="flex items-start gap-2 text-sm text-slate-600">
                          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-slate-400"/>{topic}
                        </li>)}
                    </ul>
                  </section>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="flex items-start gap-2 text-xs leading-5 text-amber-900">
                      <Info className="mt-0.5 size-4 shrink-0"/>{selected.certification.note}
                    </p>
                  </div>
                  <a href={selected.certification.officialUrl} target="_blank" rel="noopener noreferrer"
                    className="btn-primary inline-flex w-full items-center justify-center gap-2 text-center">
                    Official exam and preparation <ExternalLink className="size-4"/>
                  </a>
                  <p className="text-center text-xs leading-5 text-slate-500">
                    Booking, fees, training, and certification issuance are managed by {selected.certification.issuer}.
                    Check the issuer for current regional prices.
                  </p>
                </div>
              </div>
            ):(
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
                Choose a credential to review its official path and skill fit.
              </div>
            )}
          </aside>
        </div>
      </section>
      <p className="mt-7 text-center text-xs leading-6 text-slate-500">
        SkillTwin is an independent guidance tool, not affiliated with these certification issuers.
        Recommendations are heuristic learning guidance, not job-placement, credential authenticity or exam-pass guarantees.
      </p>
    </main>
  );
}
