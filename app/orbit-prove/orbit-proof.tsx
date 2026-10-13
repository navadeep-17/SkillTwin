"use client";

import Link from "next/link";
import {useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {
  ArrowRight, ArrowUpRight, BrainCircuit, Check, CheckCircle2, ChevronRight,
  Clock3, FileCheck2, Fingerprint, GitBranch, LoaderCircle,
  LockKeyhole, Search, ShieldCheck, Sparkles, Target, Zap
} from "lucide-react";
import {
  evidenceReliabilityLabel,normalizedConfidence,type TwinEvidence,type TwinProofTrail
} from "@/lib/domain/twin-challenge";

export type OrbitProofSkill={
  id:string;name:string;category:string;description:string;level:string;
  capability:number|null;confidence:number|null;evidenceCount:number;conflict:string;
  questionCount:number;activeAssessmentId:string|null;
  availability:"RESUME"|"READY"|"NO_VALIDATED_BANK";
  evidence:TwinEvidence[];proof:TwinProofTrail|null;
};
type ChallengeConcern="UNDERESTIMATED"|"OVERESTIMATED"|"UNCERTAIN";
const choices:{id:ChallengeConcern;title:string;description:string}[]=[
  {id:"UNDERESTIMATED",title:"I think I know more",description:"Question a possibly low capability estimate"},
  {id:"OVERESTIMATED",title:"My estimate could be high",description:"Validate whether the evidence supports the level"},
  {id:"UNCERTAIN",title:"I want a clearer picture",description:"Replace uncertainty with independent evidence"}
];
const label=(s:string)=>s.replaceAll("_"," ").toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
const cap=(v:number|null)=>v==null?"Unknown":v.toFixed(2)+"/4";
const conf=(v:number|null)=>normalizedConfidence(v)==null?"Unknown":normalizedConfidence(v)+"%";
const last=(v:string)=>{const d=new Date(v);return Number.isFinite(d.getTime())?d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"}):"Date unavailable";};
function ProvenResult({trail}:{trail:TwinProofTrail}){
  const before=trail.before,after=trail.after;
  const stateChanged=before?.capability!=null&&after?.capability!=null
    ? Math.abs(before.capability-after.capability)>.001:null;
  return <section className="op-proof-result" aria-label="Recorded assessment outcome">
    <div className="op-proof-result-title"><CheckCircle2 size={19}/><span>Recorded completed challenge</span></div>
    <div className="op-proof-result-numbers">
      <div><span>Assessed score</span><strong>{trail.scorePercent==null?"Not reported":trail.scorePercent+"%"}</strong></div>
      <div><span>Coverage</span><strong>{trail.coveragePercent==null?"Not reported":trail.coveragePercent+"%"}</strong></div>
      <div><span>Skill estimate</span><strong>{stateChanged===null?"History unavailable":stateChanged?"Revised":"Confirmed"}</strong></div>
    </div>
    <div className="op-evolution">
      <div><small>Capability before</small><strong>{cap(before?.capability??null)}</strong><span>Confidence: {before?.confidencePercent==null?"Unknown":before.confidencePercent+"%"}</span></div>
      <ArrowRight size={19}/><div><small>Capability after</small><strong>{cap(after?.capability??null)}</strong><span>Confidence: {after?.confidencePercent==null?"Unknown":after.confidencePercent+"%"}</span></div>
    </div>
    {trail.skillExplanation&&<p className="op-proof-explanation">{trail.skillExplanation}</p>}
    <div className="op-roadmap-outcome">
      <div className="op-roadmap-outcome-heading"><GitBranch size={18}/>
        <strong>{trail.planStatus==="CHANGED"?"Roadmap revised":trail.planStatus==="UNCHANGED"?"Roadmap deliberately unchanged":"Roadmap decision not recorded"}</strong>
      </div>
      <p>{trail.planReason}</p>
      {trail.planDiffId&&<Link href={"/roadmap/changes/"+encodeURIComponent(trail.planDiffId)}>Inspect the recorded PlanDiff <ArrowUpRight size={15}/></Link>}
    </div>
  </section>;
}
export function OrbitProof({skills,initialSkillId}:{skills:OrbitProofSkill[];initialSkillId?:string}){
  const router=useRouter();
  const initial=initialSkillId??skills.find(x=>x.proof)?.id??skills.find(x=>x.availability!=="NO_VALIDATED_BANK")?.id??skills[0]?.id??"";
  const [selectedId,setSelectedId]=useState(initial);
  const [filter,setFilter]=useState<"ready"|"recorded"|"all">("ready");
  const [search,setSearch]=useState("");
  const [concern,setConcern]=useState<ChallengeConcern>("UNCERTAIN");
  const [pending,setPending]=useState(false);
  const [error,setError]=useState("");
  const filtered=useMemo(()=>skills.filter(x=>{
    if(filter==="ready"&&x.availability==="NO_VALIDATED_BANK")return false;
    if(filter==="recorded"&&x.evidenceCount===0&&!x.proof)return false;
    return !search.trim()||(x.name+" "+x.category).toLowerCase().includes(search.toLowerCase().trim());
  }),[skills,filter,search]);
  const selected=skills.find(x=>x.id===selectedId)??skills[0]??null;
  const proofReady=skills.filter(s=>s.availability!=="NO_VALIDATED_BANK").length;
  const proofCount=skills.filter(s=>Boolean(s.proof)).length;
  const evidenceCount=skills.filter(s=>s.evidenceCount>0).length;
  async function start(item:OrbitProofSkill){
    if(pending)return;
    setError("");
    if(item.activeAssessmentId){
      router.push("/orbit-prove/session/"+encodeURIComponent(item.activeAssessmentId));
      return;
    }
    if(item.availability!=="READY")return;
    setPending(true);
    try {
      const response=await fetch("/api/assessments",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({mode:"CHALLENGE_ME",targetSkillId:item.id})
      });
      const payload=await response.json();
      if(!response.ok||!payload.ok||!payload.data?.assessment?.id){
        setError(payload.error?.message??"Could not prepare the verified challenge.");
        return;
      }
      router.push("/orbit-prove/session/"+encodeURIComponent(payload.data.assessment.id));
    }catch{
      setError("Connection failed. No assessment result or skill change was recorded from this request.");
    }finally{
      setPending(false);
    }
  }
  return <div className="op-main">
    <header className="op-heading">
      <div><p className="orbit-kicker"><Fingerprint size={16}/> CHALLENGE THE INTELLIGENCE</p>
        <h1>Your skills deserve <em>real proof.</em></h1>
        <p>See what your Twin believes, challenge an estimate, and understand exactly which evidence did—or did not—change your path.</p></div>
      <Link href="/orbit-skills" className="op-back-link">Explore my Twin <ArrowUpRight size={15}/></Link>
    </header>
    <div className="op-stats">
      <div><FileCheck2 size={20}/><span>Skills with evidence</span><strong>{evidenceCount}</strong></div>
      <div><Zap size={20}/><span>Challenge available</span><strong>{proofReady}</strong></div>
      <div><ShieldCheck size={20}/><span>Completed proof records</span><strong>{proofCount}</strong></div>
    </div>
    <div className="op-workspace">
      <aside className="op-picker" aria-label="Choose a skill to challenge">
        <label className="op-search"><Search size={17}/><span className="sr-only">Search for a skill</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search your skills..." aria-label="Search your skills"/></label>
        <div className="op-filters" aria-label="Filter challenge skills">
          {([{id:"ready",name:"Ready"},{id:"recorded",name:"My evidence"},{id:"all",name:"All"}] as const).map(v=>
            <button type="button" key={v.id} className={filter===v.id?"active":""} aria-pressed={filter===v.id} onClick={()=>setFilter(v.id)}>{v.name}</button>)}
        </div>
        <div className="op-skill-list">
          {filtered.map(item=><button type="button" key={item.id} className={"op-skill-option"+(item.id===selected?.id?" active":"")}
            aria-pressed={item.id===selected?.id} onClick={()=>{setSelectedId(item.id);setConcern("UNCERTAIN");setError("");}}>
            <span className="op-skill-emblem"><BrainCircuit size={17}/></span>
            <span><strong>{item.name}</strong><small>{item.availability==="RESUME"?"Continue assessment":item.availability==="READY"?"Verified challenge ready":"No validated question bank"}</small></span>
            {item.proof?<CheckCircle2 size={16} className="op-verified"/>:<ChevronRight size={16}/>}
          </button>)}
          {!filtered.length&&<p className="op-empty-list">No matching skills. Try the All filter.</p>}
        </div>
      </aside>
      <section className="op-detail" aria-label="Skill estimate and challenge" id="orbit-proof-detail">
        {selected?<div key={selected.id} className="op-detail-content">
          <div className="op-selected-head"><div><span className="op-overline"><Target size={15}/> CURRENT ESTIMATE</span><h2>{selected.name}</h2><p>{selected.description||"Skill from your career competency model."}</p></div><span className="op-level">{label(selected.level)}</span></div>
          <div className="op-estimate-row"><div><small>Capability</small><strong>{cap(selected.capability)}</strong></div><div><small>Confidence</small><strong>{conf(selected.confidence)}</strong></div><div><small>Evidence records</small><strong>{selected.evidenceCount}</strong></div></div>
          {selected.conflict==="UNRESOLVED"&&<p className="op-conflict" role="status">Your evidence sources disagree. Completing a validated assessment may clarify the estimate.</p>}
          <p className="op-estimate-caveat"><ShieldCheck size={15}/> Capability and confidence are separate. Unknown is not zero, and an estimate is not a certification.</p>
          {selected.proof?<ProvenResult trail={selected.proof}/>:<div className="op-no-proof"><Sparkles size={19}/><span>No completed proof is recorded for this skill yet. A new challenge can help you test the estimate.</span></div>}
          <section className="op-ledger"><h3><FileCheck2 size={17}/> Evidence inspected <span>{selected.evidence.length} recent entries</span></h3>
            {selected.evidence.length?<div className="op-evidence-grid">{selected.evidence.map((e,i)=><div key={e.created_at+e.source_type+i} className="op-evidence"><div><span>{evidenceReliabilityLabel(e.source_type)}</span><small>{label(e.status)}</small></div><p>{e.claim}</p></div>)}</div>
            :<p className="op-quiet">No recent accepted or non-aggregating evidence is available in the preview for this skill.</p>}
            {selected.evidenceCount>selected.evidence.length&&<p className="op-quiet">This is a bounded recent-evidence preview; the count above comes from canonical learner state.</p>}
          </section>
          <section className="op-challenge-block">
            <div className="op-challenge-header"><Fingerprint size={20}/><div><h3>Challenge this estimate</h3><p>Your concern does not affect grading. Only evaluated answers can add accepted evidence.</p></div></div>
            <div className="op-concerns" role="group" aria-label="What concerns you about this estimate?">
              {choices.map(v=><button type="button" key={v.id} aria-pressed={concern===v.id} className={concern===v.id?"active":""} onClick={()=>setConcern(v.id)}>
                <span className="op-radio">{concern===v.id&&<Check size={12}/>}</span><span><strong>{v.title}</strong><small>{v.description}</small></span>
              </button>)}
            </div>
            {selected.availability==="NO_VALIDATED_BANK"?<p className="op-locked"><LockKeyhole size={16}/> At least four validated questions are required. SkillTwin will not generate a fictional result.</p>:
              <button type="button" className="op-launch" disabled={pending} onClick={()=>void start(selected)}>
                {pending?<LoaderCircle size={17} className="op-spin"/>:<Zap size={17}/>}
                {pending?"Preparing validated assessment…":selected.availability==="RESUME"?"Resume current assessment":"Start verified challenge"}
                {!pending&&<ArrowRight size={17}/>}
              </button>}
            {error&&<p className="op-error" role="alert">{error}</p>}
          </section>
        </div>:<div className="op-empty-list">No active catalog skills are available.</div>}
      </section>
    </div>
    <div className="op-trust"><ShieldCheck size={18}/><p>Only authenticated assessment service results can update your evidence. The proof cards display stored history and recorded replan decisions, including when no roadmap change is warranted.</p></div>
  </div>;
}
