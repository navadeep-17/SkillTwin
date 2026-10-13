"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background, Controls, MarkerType, Position,
  type Edge, type Node
} from "reactflow";
import "reactflow/dist/style.css";
import {
  ArrowRight, ArrowUpRight, BrainCircuit, CheckCircle2, Compass,
  Eye, FileCheck2, Fingerprint, GitBranch, LayoutGrid, List,
  Network, Search, ShieldCheck, Sparkles, Target
} from "lucide-react";

export type OrbitEvidence = {
  id: string;
  sourceType: string;
  claim: string | null;
  levelSignal: string | null;
  status: "ACCEPTED" | "NON_AGGREGATING";
  createdAt: string;
};
export type OrbitSkill = {
  requirementId: string;
  skillId: string;
  name: string;
  category: string | null;
  description: string | null;
  stage: number;
  target: number;
  capability: number | null;
  confidence: number | null;
  evidenceCount: number;
  sourceFamilyCount: number;
  conflictState: string | null;
  lastValidated: string | null;
  status: "STRONG" | "DEVELOPING" | "GAP" | "UNKNOWN";
  priorityBand: string | null;
  priorityScore: number | null;
  gapSeverity: number | null;
  action: string | null;
  evidence: OrbitEvidence[];
};
export type OrbitDependency = {
  from: string;
  to: string;
  type: "HARD" | "SOFT";
};
type Filter = "all" | "focus" | "evidence";
type View = "graph" | "list";
const tones = {
  STRONG: { accent: "#52E7C7", label: "Strong" },
  DEVELOPING: { accent: "#F7C67E", label: "Developing" },
  GAP: { accent: "#F29BA3", label: "Needs development" },
  UNKNOWN: { accent: "#91A2C2", label: "Not evaluated" }
} as const;
function formatScore(score: number | null) { return score == null || !Number.isFinite(score) ? "Not estimated" : score.toFixed(2) + " / 4"; }
function formatPercent(value: number | null) { return value == null || !Number.isFinite(value) ? "Unknown" : Math.round(value * 100) + "%"; }
function formatDate(value: string | null) {
  if (!value) return "Not yet validated";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function formatCode(value: string | null) { return value ? value.toLowerCase().replaceAll("_", " ").replace(/^./,x=>x.toUpperCase()) : "Not assigned"; }
function isPriority(item: OrbitSkill) { return item.status === "GAP" || item.priorityBand === "HIGH" || item.priorityBand === "CRITICAL"; }
function EvidenceRow({ item }: { item: OrbitEvidence }) {
  return (
    <div className="orbit-skills-evidence-row">
      <div className="orbit-skills-evidence-top">
        <span className="orbit-skills-source">{formatCode(item.sourceType)}</span>
        <span className={"orbit-skills-evidence-type " + (item.status === "ACCEPTED" ? "accepted" : "")}>{item.status === "ACCEPTED" ? "Accepted evidence" : "Non-aggregating"}</span>
        <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
      </div>
      {item.claim ? <p>{item.claim}</p> : <p>Recorded evidence without an additional textual claim.</p>}
      {item.levelSignal && <small>Signal: {formatCode(item.levelSignal)}</small>}
    </div>
  );
}
function Detail({ selected, dependencies, skills }: { selected: OrbitSkill | null; dependencies: OrbitDependency[]; skills: OrbitSkill[] }) {
  if (!selected) return (
    <div className="orbit-skills-placeholder">
      <span className="orbit-skills-placeholder-icon"><Eye size={24}/></span>
      <h3>Choose a competency</h3>
      <p>Select a node or skill row to inspect its actual evidence, confidence, prerequisite links, and target level.</p>
    </div>
  );
  const connected = dependencies.filter(edge => edge.from === selected.requirementId || edge.to === selected.requirementId);
  const byId = new Map(skills.map(skill => [skill.requirementId, skill]));
  const tone = tones[selected.status];
  return (
    <div className="orbit-skills-detail" key={selected.requirementId}>
      <div className="orbit-skills-detail-header">
        <div className="orbit-skills-kicker"><span className="orbit-skills-dot" style={{ background: tone.accent }}/>{tone.label} · Stage {selected.stage}</div>
        <h2>{selected.name}</h2>
        <p>{selected.description || "Role competency in your selected career model."}</p>
      </div>
      <div className="orbit-skills-values">
        <div><span>Capability</span><strong>{formatScore(selected.capability)}</strong></div>
        <div><span>Role target</span><strong>{formatScore(selected.target)}</strong></div>
        <div><span>Confidence</span><strong>{formatPercent(selected.confidence)}</strong></div>
        <div><span>Role gap</span><strong>{formatPercent(selected.gapSeverity)}</strong></div>
      </div>
      <div className="orbit-skills-insight">
        <ShieldCheck size={18}/>
        <p><strong>Capability and confidence are independent.</strong> A low-confidence estimate means SkillTwin needs better evidence; it does not prove that you lack this skill.</p>
      </div>
      <div className="orbit-skills-inspector-group">
        <h3>Current decision</h3>
        <dl>
          <div><dt>Recommended action</dt><dd>{formatCode(selected.action)}</dd></div>
          <div><dt>Priority</dt><dd>{formatCode(selected.priorityBand)}</dd></div>
          <div><dt>Independent source families</dt><dd>{selected.sourceFamilyCount}</dd></div>
          <div><dt>Last validated</dt><dd>{formatDate(selected.lastValidated)}</dd></div>
          {selected.conflictState && <div><dt>Conflict state</dt><dd>{formatCode(selected.conflictState)}</dd></div>}
        </dl>
      </div>
      <div className="orbit-skills-inspector-group">
        <h3><GitBranch size={15}/> Dependencies <span>{connected.length}</span></h3>
        {connected.length ? <div className="orbit-skills-relations">
          {connected.map((edge,i) => {
            const related = byId.get(edge.from === selected.requirementId ? edge.to : edge.from);
            return related ? <div key={i}><span>{edge.to === selected.requirementId ? "Prerequisite" : "Unlocks"}</span><strong>{related.name}</strong><small>{edge.type === "HARD" ? "Required" : "Supporting"} connection</small></div> : null;
          })}
        </div> : <p className="orbit-skills-muted">No dependency edges recorded for this role requirement.</p>}
      </div>
      <div className="orbit-skills-inspector-group">
        <h3><FileCheck2 size={16}/> Evidence ledger <span>{selected.evidenceCount}</span></h3>
        {selected.evidence.length ? <div className="orbit-skills-evidence-list">{selected.evidence.map(item => <EvidenceRow item={item} key={item.id}/>)}</div> :
          <p className="orbit-skills-muted">{selected.evidenceCount ? "No matching records were included in the bounded recent-evidence preview. Inspect the full ledger for details." : "No skill evidence recorded yet."}</p>}
        {selected.evidenceCount > selected.evidence.length && <p className="orbit-skills-muted">Showing {selected.evidence.length} recent records of {selected.evidenceCount} counted observations. Some entries may be outside the preview limit.</p>}
      </div>
      <div className="orbit-skills-detail-actions">
        <Link href="/challenge-my-twin">Challenge my Twin <Fingerprint size={15}/></Link>
        <Link href="/passport">Evidence Passport <ArrowUpRight size={14}/></Link>
      </div>
    </div>
  );
}

export function OrbitSkillExperience({ roleName, skills, dependencies }: { roleName: string | null; skills: OrbitSkill[]; dependencies: OrbitDependency[] }) {
  const [query,setQuery] = useState("");
  const [filter,setFilter] = useState<Filter>("all");
  const [view,setView] = useState<View>("graph");
  const [selectedId,setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (window.matchMedia("(max-width: 760px)").matches) setView("list");
  }, []);
  const visible = useMemo(() => skills.filter(skill => {
    const searched = !query || [skill.name,skill.category ?? "",skill.description ?? ""].some(x => x.toLowerCase().includes(query.toLowerCase().trim()));
    const allowed = filter === "all" || filter === "focus" && isPriority(skill) || filter === "evidence" && skill.evidenceCount > 0;
    return searched && allowed;
  }),[skills,query,filter]);
  const selected = visible.find(s => s.requirementId === selectedId) ?? null;
  const visibleIds = useMemo(() => new Set(visible.map(x=>x.requirementId)),[visible]);
  const filteredEdges = dependencies.filter(x=>visibleIds.has(x.from) && visibleIds.has(x.to));
  const connected = useMemo(() => {
    const ids = new Set<string>(selectedId ? [selectedId] : []);
    for (const e of filteredEdges) if (e.from === selectedId || e.to === selectedId) { ids.add(e.from);ids.add(e.to); }
    return ids;
  },[filteredEdges,selectedId]);
  const { nodes, edges } = useMemo(() => {
    const stages = [...new Set(visible.map(x=>x.stage))].sort((a,b)=>a-b);
    const nodes: Node[] = [];
    stages.forEach((stage,stageIndex) => {
      const stageSkills = visible.filter(x=>x.stage===stage).sort((a,b)=>a.name.localeCompare(b.name));
      stageSkills.forEach((skill,index) => {
        const tone=tones[skill.status];
        const chosen=selectedId===skill.requirementId;
        nodes.push({
          id:skill.requirementId,
          position: { x: 32 + stageIndex*320, y: 35 + index*154 },
          type:"default",
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
          selected:chosen,
          draggable:false,
          data:{ label:<div className="orbit-skills-node-content">
            <div className="orbit-skills-node-top"><span className="orbit-skills-dot" style={{background:tone.accent}}/><strong>{skill.name}</strong></div>
            <small>{tone.label} · {skill.category ?? "Skill"}</small>
            <div className="orbit-skills-node-bars"><div><span>Capability</span><b>{skill.capability == null ? "Unknown" : skill.capability.toFixed(1)+"/4"}</b></div><div><span>Confidence</span><b>{formatPercent(skill.confidence)}</b></div></div>
          </div>},
          style:{
            width:264,
            background:"#19223A",
            color:"#EAF0FF",
            border:chosen?"2px solid #B5A6FF":"1px solid "+tone.accent+"66",
            borderRadius:16,
            boxShadow:chosen?"0 0 0 5px rgba(154,137,255,.13),0 10px 40px rgba(0,0,0,.28)":"0 7px 28px rgba(0,0,0,.1)",
            opacity:selectedId && !connected.has(skill.requirementId)?0.32:1,
            padding:14,
            transition:"opacity .2s, box-shadow .2s, border .2s"
          }
        });
      });
    });
    const edges: Edge[] = filteredEdges.map((edge,i) => {
      const highlighted=selectedId && (edge.from===selectedId||edge.to===selectedId);
      return {
        id:"rel-"+i+"-"+edge.from+"-"+edge.to,source:edge.from,target:edge.to,
        markerEnd:{type:MarkerType.ArrowClosed,color:highlighted?"#B5A6FF":"#7885A7"},
        animated:Boolean(highlighted && edge.type==="HARD"),
        style:{stroke:highlighted?"#B5A6FF":"#7885A7",opacity:selectedId&&!highlighted?.15:.68,strokeWidth:highlighted?2.5:1.5,strokeDasharray:edge.type==="SOFT"?"6 6":undefined}
      };
    });
    return {nodes,edges};
  },[visible,filteredEdges,selectedId,connected]);
  const observed=skills.filter(s=>s.capability!=null).length;
  const proofBacked=skills.filter(s=>s.evidenceCount>0).length;
  const priority=skills.filter(isPriority).length;

  return (
    <div className="orbit-skills-inner">
      <header className="orbit-skills-heading">
        <div>
          <p className="orbit-kicker"><BrainCircuit size={16}/> YOUR EVIDENCE-GROUNDED SKILLTWIN</p>
          <h1>Explore your <em>skill universe.</em></h1>
          <p>Trace the connections between where you are, what your role requires and the evidence SkillTwin has actually seen.</p>
        </div>
        <div className="orbit-skills-target"><Target size={19}/><span><small>Career target</small><strong>{roleName ?? "Not selected yet"}</strong></span></div>
      </header>
      <section className="orbit-skills-overview" aria-label="Skill model metrics">
        <div><Network size={19}/><span>Role requirements</span><strong>{skills.length}</strong></div>
        <div><Eye size={19}/><span>Estimated capabilities</span><strong>{observed}</strong></div>
        <div><FileCheck2 size={19}/><span>With evidence records</span><strong>{proofBacked}</strong></div>
        <div><Compass size={19}/><span>Priority requirements</span><strong>{priority}</strong></div>
      </section>
      {!skills.length ? <section className="orbit-skills-empty"><span><Sparkles size={32}/></span><h2>Your skill constellation starts with a goal.</h2><p>Choose a target career and add evidence to unlock its requirement graph. Unknown skills are never treated as failures.</p><Link href="/orbit-onboarding">Build my SkillTwin <ArrowRight size={16}/></Link></section> :
      <>
        <div className="orbit-skills-toolbar">
          <label className="orbit-skills-search"><Search size={17}/><span className="sr-only">Find a skill</span><input type="search" value={query} onChange={e=>{setQuery(e.target.value);setSelectedId(null);}} placeholder="Search competencies" /></label>
          <div className="orbit-skills-filters" role="group" aria-label="Filter competencies">
            {([{id:"all",label:"All skills"},{id:"focus",label:"Priority gaps"},{id:"evidence",label:"Has evidence"}] as const).map(v=><button type="button" key={v.id} aria-pressed={filter===v.id} className={filter===v.id?"active":""} onClick={()=>{setFilter(v.id);setSelectedId(null);}}>{v.label}</button>)}
          </div>
          <div className="orbit-skills-view" role="group" aria-label="Select graph or list">
            <button type="button" onClick={()=>setView("graph")} aria-pressed={view==="graph"} className={view==="graph"?"active":""}><LayoutGrid size={16}/> Graph</button>
            <button type="button" onClick={()=>setView("list")} aria-pressed={view==="list"} className={view==="list"?"active":""}><List size={16}/> List</button>
          </div>
        </div>
        <div className="orbit-skills-workspace">
          <section className="orbit-skills-canvas" aria-label="Role competency network">
            <div className="orbit-skills-canvas-header"><span><GitBranch size={16}/> Requirement network</span><small>Drag to explore · Use controls to fit all · Solid: required · Dashed: supporting</small></div>
            {!visible.length ? <div className="orbit-skills-zero"><Search size={25}/><strong>No matching competencies</strong><p>Try another search or filter.</p><button onClick={()=>{setQuery("");setFilter("all");}}>Clear filters</button></div> :
              view==="graph" ? <div className="orbit-skills-flow">
                <ReactFlow nodes={nodes} edges={edges} defaultViewport={{ x: 32, y: 130, zoom: .85 }} nodesDraggable={false} nodesConnectable={false}
                  minZoom={.25} maxZoom={1.9} onNodeClick={(_,node)=>setSelectedId(node.id)} onPaneClick={()=>setSelectedId(null)}>
                  <Background color="#3A4664" gap={23} size={1}/>
                  <Controls showInteractive={false} position="bottom-left"/>
                </ReactFlow>
              </div> : <div className="orbit-skills-list">
                {visible.map(skill=>{
                  const tone=tones[skill.status];
                  return <button type="button" key={skill.requirementId} onClick={()=>setSelectedId(skill.requirementId)} aria-pressed={selectedId===skill.requirementId}
                    className={"orbit-skills-list-item"+(selectedId===skill.requirementId?" active":"")}>
                    <span className="orbit-skills-dot" style={{background:tone.accent}}/>
                    <span className="orbit-skills-list-text"><strong>{skill.name}</strong><small>{tone.label} · Stage {skill.stage} · {skill.evidenceCount} records</small></span>
                    <span className="orbit-skills-list-score">{skill.capability==null?"Unknown":skill.capability.toFixed(1)+"/4"}</span>
                    <ArrowRight size={17}/>
                  </button>;
                })}
              </div>}
          </section>
          <aside className="orbit-skills-inspector" aria-label="Skill details and evidence">
            <Detail selected={selected} skills={visible} dependencies={filteredEdges}/>
          </aside>
        </div>
        <div className="orbit-skills-note"><CheckCircle2 size={17}/><span>Read-only beta: SkillTwin estimates, gap decisions and evidence are fetched from your own saved learner state. Selecting, filtering and exploring never changes proficiency or confidence.</span></div>
        <footer className="orbit-skills-footer"><Link href="/orbit-beta">Back to Today <ArrowRight size={15}/></Link><Link href="/skills">Open original Skills view <ArrowUpRight size={14}/></Link></footer>
      </>}
    </div>
  );
}
