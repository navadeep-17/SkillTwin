"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight, BrainCircuit, CheckCircle2, Compass, Fingerprint,
  GitBranch, Lightbulb, Network, Route, ShieldCheck, Target
} from "lucide-react";

export type OrbitTodayModel = {
  roleName: string | null;
  readiness: number | null;
  coverage: number | null;
  lastUpdated: string | null;
  nodes: Array<{
    id: string;
    skillId: string;
    name: string;
    status: "STRONG" | "DEVELOPING" | "GAP" | "UNKNOWN";
    capability: number | null;
    confidence: number | null;
    evidenceCount: number;
    target: number;
    stage: number;
  }>;
  dependencies: Array<{ from: string; to: string; type: "HARD" | "SOFT" }>;
  priorities: Array<{ skillId: string; name: string; action: string; band: string }>;
};

const palette = {
  STRONG: { color: "#52E7C7", label: "Strong" },
  DEVELOPING: { color: "#F7C67E", label: "Developing" },
  GAP: { color: "#F39B9B", label: "Role gap" },
  UNKNOWN: { color: "#8290AF", label: "Unknown" }
} as const;
const percentage = (value: number | null) =>
  value == null || !Number.isFinite(value) ? "—" : Math.round(Math.max(0, Math.min(100, value))) + "%";
const friendly = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/^./, x => x.toUpperCase());

function RealSkillGraph({
  model, selectedId, onSelect
}: {
  model: OrbitTodayModel;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const visible = useMemo(() => model.nodes.slice(0, 16), [model.nodes]);
  const points = useMemo(() => {
    const count = visible.length;
    return visible.map((node, index) => {
      const angle = -Math.PI / 2 + (index * 2 * Math.PI / Math.max(count, 1));
      return {
        node,
        x: 300 + 216 * Math.cos(angle),
        y: 222 + 160 * Math.sin(angle)
      };
    });
  }, [visible]);
  const byId = useMemo(() => new Map(points.map(point => [point.node.id, point])), [points]);
  if (!visible.length) {
    return <div className="orbit-live-graph-empty"><BrainCircuit size={30} /><strong>Your Twin is waiting for a career goal</strong><p>Select a role and add evidence to reveal the role's actual competency network.</p><Link href="/orbit-onboarding">Start building your Twin <ArrowRight size={16}/></Link></div>;
  }
  return (
    <div className="orbit-live-graph">
      <svg viewBox="0 0 600 450" role="group" aria-label="Interactive role requirement graph. Select any node to inspect its canonical state.">
        <defs>
          <radialGradient id="orbit-live-core-glow"><stop offset="0" stopColor="#7b6df4" stopOpacity=".26"/><stop offset="1" stopColor="#7b6df4" stopOpacity="0"/></radialGradient>
        </defs>
        <circle cx="300" cy="222" r="155" fill="url(#orbit-live-core-glow)" />
        <circle cx="300" cy="222" r="125" fill="none" stroke="#8977FF" strokeDasharray="4 7" strokeOpacity=".13"/>
        {model.dependencies.map((dep, index) => {
          const from = byId.get(dep.from);
          const to = byId.get(dep.to);
          if (!from || !to) return null;
          const highlighted = selectedId === dep.from || selectedId === dep.to;
          return <line key={dep.from+"-"+dep.to+"-"+index} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={highlighted?"#A99AFF":"#677092"} strokeWidth={highlighted?2.5:1.4} strokeDasharray={dep.type==="SOFT"?"5 5":undefined} opacity={highlighted?0.92:0.4}/>;
        })}
        <circle cx="300" cy="222" r="47" fill="#33285C" stroke="#A99AFF" strokeWidth="2"/>
        <circle cx="300" cy="222" r="29" fill="#7060CC" opacity=".55"/>
        <path d="M300 199 L322 222 L300 245 L278 222 Z" fill="none" stroke="#E2DDFF" strokeWidth="2.5"/>
        <circle cx="300" cy="222" r="5" fill="#fff"/>
        <text x="300" y="280" textAnchor="middle" fill="#D8D0FF" fontSize="11" fontWeight="600">Your Twin</text>
        {points.map(({node,x,y}) => {
          const tone = palette[node.status];
          const selected = node.id === selectedId;
          return (
            <g key={node.id} role="button" tabIndex={0} focusable="true"
              aria-label={node.name+", "+tone.label+", "+node.evidenceCount+" evidence records"}
              aria-pressed={selected}
              onClick={() => onSelect(node.id)}
              onKeyDown={event => {
                if(event.key==="Enter" || event.key===" "){event.preventDefault();onSelect(node.id);}
              }}
              className="orbit-live-node">
              <circle cx={x} cy={y} r={selected?26:20} fill={tone.color} opacity={selected?.25:.09}/>
              <circle cx={x} cy={y} r={selected?13:11} fill="#151C33" stroke={tone.color} strokeWidth={selected?3:2}/>
              <circle cx={x} cy={y} r="4" fill={tone.color}/>
              <text x={x} y={y+34} textAnchor="middle" fill="#D7DEF1" fontSize="10.5" fontWeight={selected?"700":"500"}>
                {node.name.length>22?node.name.slice(0,20)+"…":node.name}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="orbit-live-node-list" aria-label="Role requirements">
        {visible.map(node => (
          <button type="button" key={node.id}
            aria-pressed={selectedId === node.id}
            onClick={() => onSelect(node.id)}
            className={"orbit-live-node-option " + (selectedId===node.id?"selected":"")}>
            <span className="orbit-live-option-dot" style={{background:palette[node.status].color}}/>
            <span><strong>{node.name}</strong><small>{palette[node.status].label} · {node.evidenceCount} evidence records</small></span>
          </button>
        ))}
      </div>
      <div className="orbit-live-legend">
        {(Object.keys(palette) as Array<keyof typeof palette>).map(status=>
          <span key={status}><i style={{background:palette[status].color}} />{palette[status].label}</span>)}
      </div>
      {model.nodes.length>visible.length && <p className="orbit-live-subtle">Showing {visible.length} of {model.nodes.length} role requirements. <Link href="/skills">View the complete skill graph</Link></p>}
    </div>
  );
}

export function OrbitTodayLive({ model }: { model: OrbitTodayModel }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = model.nodes.find(x => x.id===selectedId) ?? null;
  const currentRole = model.roleName ?? "Your target career";
  const stamp = model.lastUpdated ? new Date(model.lastUpdated).toISOString().slice(0,10) : null;
  return (
    <main className="orbit-lab orbit-live">
      <div className="orbit-live-inner">
        <header className="orbit-live-top">
          <div><div className="orbit-kicker"><span className="orbit-live-dot"/> YOUR PERSONAL MISSION CONTROL</div>
            <h1>Build the future.<br/><em>Show the evidence.</em></h1>
            <p>Real role requirements and learner estimates—not a simulated dashboard.</p>
          </div>
          <div className="orbit-live-role"><Compass size={17}/><span><small>Active goal</small><strong>{currentRole}</strong></span></div>
        </header>
        <div className="orbit-live-layout">
          <section className="orbit-panel orbit-live-twin-panel">
            <div className="orbit-panel-overline"><Network size={15}/> YOUR EVIDENCE-GROUNDED TWIN <span>LIVE STATE</span></div>
            <RealSkillGraph model={model} selectedId={selectedId} onSelect={setSelectedId}/>
            <div className="orbit-live-inspector" aria-live="polite">
              {selected ? <>
                <div><span>Selected competency</span><strong>{selected.name}</strong><small>{palette[selected.status].label} · Stage {selected.stage} · {selected.evidenceCount} evidence records</small></div>
                <div className="orbit-live-facts">
                  <div><span>Capability</span><strong>{selected.capability==null?"Unknown":selected.capability.toFixed(2)+"/4"}</strong></div>
                  <div><span>Confidence</span><strong>{selected.confidence==null?"Unknown":percentage(selected.confidence*100)}</strong></div>
                  <div><span>Role target</span><strong>{selected.target.toFixed(2)+"/4"}</strong></div>
                </div>
              </> : <div><span>Explore your SkillTwin</span><strong>Select a competency node</strong><small>Inspect current capability, evidence confidence, and the target level separately.</small></div>}
            </div>
            <div className="orbit-live-actions"><Link href="/skills">Inspect evidence <ArrowRight size={15}/></Link><Link href="/challenge-my-twin">Challenge my Twin <Fingerprint size={15}/></Link></div>
          </section>
          <aside className="orbit-live-side">
            <section className="orbit-panel orbit-live-metric">
              <div className="orbit-panel-overline"><Target size={15}/> ROLE READINESS</div>
              <div className="orbit-live-number">{percentage(model.readiness)}</div>
              <div className="orbit-live-progress" role="progressbar" aria-label="Role readiness" aria-valuemin={0} aria-valuemax={100} aria-valuenow={model.readiness==null?undefined:Math.round(Math.max(0,Math.min(100,model.readiness)))}>
                <span style={{width:model.readiness==null?"0%":percentage(model.readiness)}} />
              </div>
              <div className="orbit-live-metric-bottom"><span>Evidence coverage: <b>{percentage(model.coverage)}</b></span>{stamp&&<span>Snapshot {stamp}</span>}</div>
              <p>Role-relative estimate, not a guarantee of employment or actual proficiency.</p>
            </section>
            <section className="orbit-panel orbit-live-next">
              <div className="orbit-panel-overline"><Lightbulb size={15}/> HIGHEST PRIORITIES</div>
              <h2>Your next areas of focus</h2>
              {model.priorities.length? <div className="orbit-live-priorities">
                {model.priorities.map(item=><div key={item.skillId} className="orbit-live-priority">
                  <span className="orbit-live-priority-dot"/>
                  <div><strong>{item.name}</strong><small>{friendly(item.action)} · {friendly(item.band)}</small></div>
                </div>)}
              </div> : <p>{model.readiness==null?"Build your SkillTwin to discover role-relative gaps.":"No outstanding priority gaps in the latest snapshot."}</p>}
              <Link className="orbit-live-cta" href="/roadmap">Continue my learning plan <ArrowRight size={16}/></Link>
            </section>
            <section className="orbit-live-explain"><ShieldCheck size={20}/><div><strong>The numbers come from SkillTwin.</strong><p>Graph relationships, confidence, readiness and priorities are read from your saved learner state. Selecting a node never changes it.</p></div></section>
          </aside>
        </div>
        <footer className="orbit-live-footer"><span><CheckCircle2 size={15}/> Read-only design preview</span><div><Link href="/orbit-onboarding">Edit your goal</Link><Link href="/overview">Current Home</Link><Link href="/roadmap">Current Plan <Route size={14}/></Link></div></footer>
      </div>
    </main>
  );
}
