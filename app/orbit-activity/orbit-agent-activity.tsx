"use client";

import {useMemo,useState} from "react";
import Link from "next/link";
import {
  Activity, ArrowRight, CheckCircle2, Compass, Database,
  Filter, Fingerprint, GitBranch, Search, ShieldCheck, Sparkles,
  Waypoints
} from "lucide-react";

export type OrbitActivityEvent={
  id:string;eventType:string;triggerType:string|null;summary:string;
  createdAt:string;evidenceCount:number;entityCount:number;
};
type Kind="all"|"evidence"|"validation"|"adaptation"|"other";
const kinds:{id:Kind;label:string}[]=[
  {id:"all",label:"All events"},
  {id:"evidence",label:"Evidence"},
  {id:"validation",label:"Validation"},
  {id:"adaptation",label:"Adaptation"},
  {id:"other",label:"Other"}
];
function categorize(eventType:string):Exclude<Kind,"all">{
  const text=eventType.toUpperCase();
  if(/REPLAN|PLAN_DIFF|ROADMAP|PLAN_VERSION|ADAPT/.test(text))return "adaptation";
  if(/ASSESS|EVALUAT|VALIDAT|CHALLENGE|PROJECT_DEFENSE/.test(text))return "validation";
  if(/EVIDENCE|SKILL|RESUME|PROFILE|INGEST/.test(text))return "evidence";
  return "other";
}
function readable(text:string){return text.toLowerCase().replace(/_/g," ").replace(/\b\w/g,char=>char.toUpperCase());}
const icons={evidence:Database,validation:Fingerprint,adaptation:GitBranch,other:Activity};
const labels={evidence:"Evidence activity",validation:"Validation activity",adaptation:"Adaptation activity",other:"System activity"};

export function OrbitAgentActivity({events}: {events:OrbitActivityEvent[]}){
  const [kind,setKind]=useState<Kind>("all");
  const [query,setQuery]=useState("");
  const filtered=useMemo(()=>{
    const search=query.trim().toLowerCase();
    return events.filter(event=>(kind==="all"||categorize(event.eventType)===kind) &&
      (!search||[event.eventType,event.summary,event.triggerType??""].some(value=>value.toLowerCase().includes(search))));
  },[events,kind,query]);
  const evidenced=events.filter(event=>event.evidenceCount>0).length;
  const adaptations=events.filter(event=>categorize(event.eventType)==="adaptation").length;
  return <div className="oa-page">
    <div className="oa-breadcrumb"><Link href="/orbit-beta">Today</Link><span>/</span><span>Agent Activity</span></div>
    <header className="oa-hero">
      <div><p className="orbit-kicker"><Activity size={16}/> YOUR AGENT, ACCOUNTABLE</p>
        <h1>Every meaningful action<br/><em>leaves a trace.</em></h1>
        <p>Your evidence, assessments and adaptive decisions have a history. Inspect actual committed events without relying on imagined agent reasoning.</p>
        <div className="oa-hero-actions"><Link href="/orbit-journey">Open Journey <ArrowRight size={15}/></Link><Link href="/orbit-prove">Review proof <ArrowRight size={15}/></Link></div>
      </div>
      <div className="oa-hero-art" aria-hidden="true"><div className="oa-hero-ring"/><div className="oa-hero-core"><Waypoints size={29}/></div><span className="oa-art-dot oa-art-one"/><span className="oa-art-dot oa-art-two"/><span className="oa-art-dot oa-art-three"/></div>
    </header>
    <div className="oa-stats" aria-label="Recorded activity summary">
      <div><Activity size={20}/><span>Recent events loaded</span><strong>{events.length}<small> / up to 60</small></strong></div>
      <div><ShieldCheck size={20}/><span>Events linking evidence</span><strong>{evidenced}</strong></div>
      <div><GitBranch size={20}/><span>Adaptation-type events</span><strong>{adaptations}</strong></div>
    </div>
    <div className="oa-main">
      <section className="oa-timeline">
        <div className="oa-heading"><div><p className="orbit-kicker"><Sparkles size={13}/> ACCOUNT ACTIVITY</p><h2>Committed event timeline</h2></div><span>Newest first · last 60</span></div>
        <p className="oa-subtitle">This view shows recorded actions and their summaries, not private model deliberation. Category labels are UI-only groupings of stored event types.</p>
        <div className="oa-toolbar">
          <label className="oa-search"><Search size={16}/><span className="sr-only">Search recorded event summaries</span><input placeholder="Search events…" type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label>
          <div className="oa-filters" aria-label="Filter event category"><Filter size={15}/>{kinds.map(item=><button key={item.id} type="button" onClick={()=>setKind(item.id)} aria-pressed={kind===item.id} className={kind===item.id?"selected":""}>{item.label}</button>)}</div>
        </div>
        {filtered.length?<div className="oa-event-list" aria-live="polite">
          {filtered.map((event,index)=>{
            const category=categorize(event.eventType),Icon=icons[category],date=new Date(event.createdAt);
            const safeTime=Number.isNaN(date.getTime())?null:date;
            return <article className="oa-event" key={event.id}>
              <div className={"oa-event-marker "+category}><Icon size={17}/></div>
              <div className="oa-event-body">
                <div className="oa-event-top">
                  <div><span className="oa-event-category">{labels[category]}</span><h3>{readable(event.eventType)}</h3></div>
                  {safeTime&&<time dateTime={event.createdAt}>{safeTime.toLocaleString("en-IN",{timeZone:"UTC",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})+" UTC"}</time>}
                </div>
                <p>{event.summary}</p>
                <div className="oa-event-tags">
                  {event.triggerType&&<span>Trigger · {readable(event.triggerType)}</span>}
                  {event.entityCount>0&&<span>{event.entityCount} entity {event.entityCount===1?"reference":"references"}</span>}
                  {event.evidenceCount>0&&<span className="oa-evidence-tag"><CheckCircle2 size={13}/>{event.evidenceCount} evidence {event.evidenceCount===1?"reference":"references"}</span>}
                </div>
              </div>
            </article>;
          })}
        </div>:<div className="oa-empty" role="status"><Compass size={30}/><h3>{events.length===0?"No committed activity yet":"Nothing matches this filter"}</h3><p>{events.length===0?"Once you add evidence, complete assessments or update a plan, committed actions can appear here.":"Try another category or clear your search to review saved events."}</p>{events.length>0&&<button type="button" onClick={()=>{setQuery("");setKind("all");}}>Clear filters</button>}</div>}
      </section>
      <aside className="oa-context">
        <div className="oa-context-card"><div className="oa-context-heading"><ShieldCheck size={20}/><h2>What you're seeing</h2></div>
          <p>Only events saved to your account are displayed. The numbers are counts of the latest retrieved records, not a complete lifetime activity total.</p>
          <div className="oa-context-separator"/>
          <h3>Follow the chain</h3><p>See what changed to your skills, what the assessment established and whether the roadmap needed adapting.</p>
          <Link href="/orbit-prove">Inspect your proof trail <ArrowRight size={15}/></Link>
        </div>
        <div className="oa-context-card muted"><h2>Continue your journey</h2><Link href="/orbit-skills"><Database size={16}/> Evidence and skills <ArrowRight size={14}/></Link><Link href="/orbit-journey"><GitBranch size={16}/> Your roadmap <ArrowRight size={14}/></Link><Link href="/journey"><Sparkles size={16}/> Ask SkillTwin <ArrowRight size={14}/></Link></div>
      </aside>
    </div>
  </div>;
}
