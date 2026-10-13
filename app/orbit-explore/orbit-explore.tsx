"use client";

import Link from "next/link";
import {useMemo,useState} from "react";
import {ArrowRight,ArrowUpRight,BookOpen,CheckCircle2,Compass,GitCompareArrows,Layers3,Search,ShieldCheck,Sparkles,Target,Zap} from "lucide-react";
import type {DiscoverableRole} from "@/components/discovery/career-discovery";
import {compareCareerRequirements,type CareerRequirementSketch} from "@/lib/domain/career-transferability";

type Props={roles:DiscoverableRole[];activeRoleVersionId?:string|null;sampleOnly?:boolean};
const display=(s:string)=>s.replaceAll("_"," ").toLowerCase().replace(/\b\w/g,m=>m.toUpperCase());
const short=(s:string,n=85)=>s.length>n?s.slice(0,n-1)+"…":s;
function toSketch(role:DiscoverableRole):CareerRequirementSketch[]{
  return role.requirements.map(r=>({skillId:r.skillId,name:r.name,groupType:r.groupType,groupName:r.groupName,documented:r.documented}));
}
function Requirements({role}:{role:DiscoverableRole}){
  const [showAll,setShowAll]=useState(false);
  const shown=showAll?role.requirements:role.requirements.slice(0,6);
  return <section className="oe-reqs" aria-label="Role competency requirements">
    <div className="oe-block-heading"><h3><Layers3 size={17}/> Competency requirements</h3><span>{role.requirementCount} modeled skills</span></div>
    <p className="oe-descriptor">Requirements are ordered by the role model's importance. A recorded skill can be a self-report and is not automatically verified.</p>
    <div className="oe-req-grid">{shown.map((r,i)=>
      <div className="oe-req" key={r.skillId+":"+i}>
        <span className={"oe-req-icon"+(r.documented?" seen":"")}>{r.documented?<CheckCircle2 size={15}/>:<Target size={15}/>}</span>
        <div><strong>{r.name}</strong><small>{display(r.importance)} priority · Target {r.targetScore.toFixed(1)}/4 · Stage {r.stage}</small>
          {r.groupType==="ANY_OF"&&<p className="oe-alternative">Alternative path · {r.groupName}</p>}
          {r.groupType==="ALL_OF"&&<p className="oe-alternative">Combined requirement · {r.groupName}</p>}
          <p>{r.rationale}</p>
        </div>
      </div>)}</div>
    {role.requirements.length>6&&<button type="button" className="oe-show-more" onClick={()=>setShowAll(v=>!v)}>{showAll?"Show fewer":"Show all "+role.requirements.length+" requirements"} <ArrowRight size={14}/></button>}
  </section>;
}
function Compare({selected,roles}:{selected:DiscoverableRole;roles:DiscoverableRole[]}){
  const [otherId,setOtherId]=useState("");
  const other=roles.find(x=>x.id===otherId&&x.id!==selected.id)??null;
  const comparison=other?compareCareerRequirements(toSketch(selected),toSketch(other)):null;
  return <section className="oe-compare" aria-label="Compare modeled careers">
    <div className="oe-block-heading"><h3><GitCompareArrows size={18}/> Career constellations</h3><span>Structural comparison</span></div>
    <p className="oe-descriptor">Compare canonical skill requirements between two modeled careers. This is not a personal suitability ranking.</p>
    <label htmlFor="oe-compare-select">Compare {selected.name} with</label>
    <select id="oe-compare-select" value={other?.id??""} onChange={e=>setOtherId(e.target.value)}>
      <option value="">Choose a second career</option>
      {roles.filter(x=>x.id!==selected.id).map(x=><option value={x.id} key={x.id}>{x.name} · {x.family}</option>)}
    </select>
    {comparison&&other&&<div className="oe-comparison-detail" aria-live="polite">
      <div className="oe-compare-counts">
        <div><strong>{comparison.shared.length}</strong><span>Shared skills</span></div>
        <div><strong>{comparison.recordedSharedCount}</strong><span>Shared with recorded profile level</span></div>
        <div><strong>{comparison.leftOnly.length+comparison.rightOnly.length}</strong><span>Distinct skills</span></div>
      </div>
      <div className="oe-comparison-lists">
        <div><h4>Shared competencies</h4><p>Same canonical skill IDs; targets may differ.</p>
          {comparison.shared.length?<ul>{comparison.shared.slice(0,8).map(s=><li key={s.skillId}>{s.name}{s.documented&&<CheckCircle2 size={14}/>}</li>)}</ul>:<p>No identical canonical skill IDs modeled.</p>}
        </div>
        <div><h4>Unique to {other.name}</h4>
          {comparison.rightOnly.length?<ul>{comparison.rightOnly.slice(0,8).map(s=><li key={s.skillId}>{s.name}{s.groupType==="ANY_OF"&&<small>Alternative pathway</small>}</li>)}</ul>:<p>No distinct skills in the current model.</p>}
        </div>
      </div>
      <div className="oe-caveat"><ShieldCheck size={16}/> Unknown or unrecorded skill is not a zero. Alternative pathway groups (ANY_OF) should not be treated as cumulative requirements.</div>
    </div>}
  </section>;
}
export function OrbitExplore({roles,activeRoleVersionId=null,sampleOnly=false}:Props){
  const [query,setQuery]=useState("");
  const [family,setFamily]=useState("All careers");
  const [selectedId,setSelectedId]=useState(roles[0]?.id??"");
  const families=useMemo(()=>["All careers",...new Set(roles.map(x=>x.family))],[roles]);
  const matching=useMemo(()=>roles.filter(x=>{
    if(family!=="All careers"&&x.family!==family)return false;
    const q=query.trim().toLowerCase();
    return !q||[x.name,x.family,...x.requirements.map(s=>s.name)].some(s=>s.toLowerCase().includes(q));
  }),[roles,query,family]);
  const selected=matching.find(r=>r.id===selectedId)??matching[0]??null;
  const selectRole=(id:string)=>{setSelectedId(id);if(typeof window!=="undefined"&&window.innerWidth<900)document.getElementById("oe-selected-role")?.scrollIntoView({block:"start",behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});};
  return <div className="oe-main">
    <header className="oe-hero">
      <div><p className="orbit-kicker"><Compass size={16}/> DISCOVER YOUR NEXT DIRECTION</p><h1>Your future has <em>many orbits.</em></h1>
        <p>Explore real modeled career requirements, recognize skills shared between paths, and discover a direction without pretending a career model predicts your future.</p>
        <div className="oe-hero-notice"><ShieldCheck size={16}/> Early-access career catalog · not live vacancies, salaries, eligibility or a fit score</div>
      </div>
      <div className="oe-hero-art" aria-hidden="true"><div className="oe-orbit-ring oe-orbit-a"/><div className="oe-orbit-ring oe-orbit-b"/><div className="oe-planet oe-planet-a"/><div className="oe-planet oe-planet-b"/><div className="oe-planet oe-planet-c"/><div className="oe-planet oe-planet-center"><Sparkles size={31}/></div></div>
    </header>
    {sampleOnly&&<div className="oe-demo-banner">Fictional career catalog preview — no real learner records or goal updates.</div>}
    <div className="oe-stat-line"><div><Compass size={17}/><strong>{roles.length}</strong> current career models</div><div><Layers3 size={17}/><strong>{families.length-1}</strong> families represented</div><Link href="/occupations">Browse occupation atlas <ArrowUpRight size={15}/></Link></div>
    <div className="oe-layout">
      <aside className="oe-catalog" aria-label="Career catalog">
        <div className="oe-catalog-head"><h2>Find your orbit</h2><small>Search roles or competencies</small></div>
        <label className="oe-search"><Search size={17}/><span className="sr-only">Search roles or competencies</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Try Python or Data Analyst" /></label>
        <label className="oe-family-label" htmlFor="oe-family-select">Career family</label>
        <select id="oe-family-select" className="oe-family-select" value={family} onChange={e=>{setFamily(e.target.value);setSelectedId("");}}>
          {families.map(x=><option key={x} value={x}>{x}</option>)}
        </select>
        <div className="oe-role-list">{matching.length?matching.map((r,i)=>
          <button type="button" key={r.id} className={"oe-role"+(selected?.id===r.id?" selected":"")} aria-pressed={selected?.id===r.id} onClick={()=>selectRole(r.id)}>
            <span className="oe-role-icon">{String(i+1).padStart(2,"0")}</span><span className="oe-role-info"><strong>{r.name}</strong><small>{r.family} · {r.requirementCount} competencies</small></span>
            {r.id===activeRoleVersionId&&<span className="oe-current-dot" title="Current target" aria-label="Current target"/>}
            <ArrowRight size={16}/>
          </button>):<div className="oe-no-results"><Search size={24}/><strong>No matching career models</strong><p>Try a different term or reset your search.</p><button type="button" onClick={()=>{setQuery("");setFamily("All careers");}}>Clear filters</button></div>}
        </div>
      </aside>
      <div id="oe-selected-role" className="oe-selected" aria-label="Selected career details">
        {selected?<div key={selected.id} className="oe-panel">
          <div className="oe-role-hero"><span className="oe-family-kicker"><Sparkles size={14}/>{selected.family}</span><h2>{selected.name}</h2>
            <div className="oe-model-meta"><span>Model v{selected.version}</span><span>{selected.source==="AI_GENERATED"?"AI-generated · review required":"Seeded starter model"}</span>{selected.id===activeRoleVersionId&&<span>Current career goal</span>}</div>
            <p>Explore this role's modeled competencies and alternative pathways. Professional qualifications and licensing may not be represented.</p>
            <div className="oe-role-actions">
              {sampleOnly?<span className="oe-disabled-cta">Sample only — no goal changes</span>:
                <Link href={"/orbit-onboarding?role="+encodeURIComponent(selected.id)}>Explore this career goal <ArrowRight size={16}/></Link>}
              <Link href="/occupations">Occupation atlas <ArrowUpRight size={15}/></Link>
            </div>
          </div>
          <div className="oe-detail-stats"><div><Target size={17}/><small>Modeled requirements</small><strong>{selected.requirementCount}</strong></div><div><BookOpen size={17}/><small>Skills already recorded</small><strong>{selected.documentedCount}<em> / {selected.requirementCount}</em></strong></div></div>
          <div className="oe-disclaimer"><ShieldCheck size={17}/><p>Recorded does not mean validated. This is not a career-fit or readiness percentage, and missing skill data remains unknown.</p></div>
          <Requirements role={selected}/>
          <Compare selected={selected} roles={roles}/>
        </div>:<div className="oe-empty-selection"><Compass size={30}/><h2>No career selected</h2><p>{roles.length?"Try a different search or filter to inspect a model.":"The career catalog has no active role models. You can explore occupation data or create your own goal."}</p><Link href={sampleOnly?"/orbit-lab":"/orbit-onboarding"}>{sampleOnly?"Back to concept lab":"Build a custom career goal"} <ArrowRight size={16}/></Link></div>}
      </div>
    </div>
    <footer className="oe-footer"><span><ShieldCheck size={16}/> Read-only career exploration</span><Link href="/orbit-skills">Explore my Twin <ArrowRight size={15}/></Link></footer>
  </div>;
}
