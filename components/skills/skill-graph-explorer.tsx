"use client";

import { useMemo, useState } from "react";
import ReactFlow, { Background, Controls, MarkerType, type Edge, type Node } from "reactflow";
import "reactflow/dist/style.css";
import Link from "next/link";

export type SkillGraphItem={
  requirementId:string;
  skillId:string;
  name:string;
  category:string;
  targetScore:number;
  currentScore:number|null;
  level:string;
  confidence:number;
  status:"STRONG"|"DEVELOPING"|"GAP";
  priorityBand:string;
  recommendedAction:string;
  rationale:string;
  evidence:Array<{id:string;source_type:string;claim:string;effective_weight:number}>;
  prerequisites:Array<{skillId:string;name:string;met:boolean}>;
};

export function SkillGraphExplorer({
  items,dependencies
}:{items:SkillGraphItem[];dependencies:Array<{from:string;to:string;type:string}>}) {
  const [selected,setSelected]=useState<SkillGraphItem|null>(null);

  const nodes=useMemo<Node[]>(()=>items.map((item,index)=>({
    id:item.requirementId,
    position:{x:(index%4)*230,y:Math.floor(index/4)*150},
    data:{
      label:(
        <button type="button" onClick={()=>setSelected(item)} className="w-full text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.category}</p>
          <p className="mt-1 font-semibold">{item.name}</p>
          <p className="mt-1 text-xs text-slate-600">{item.level} · {Math.round(item.confidence*100)}% confidence</p>
          <span className="mt-2 inline-flex rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold">{item.status}</span>
        </button>
      )
    },
    style:{
      width:200,
      borderRadius:14,
      border:item.status==="STRONG"?"2px solid #16a34a":item.status==="DEVELOPING"?"2px solid #d97706":"2px solid #dc2626",
      background:item.status==="STRONG"?"#f0fdf4":item.status==="DEVELOPING"?"#fffbeb":"#fef2f2",
      padding:10
    }
  })),[items]);

  const edges=useMemo<Edge[]>(()=>dependencies.map((edge,index)=>({
    id:"e-"+index,
    source:edge.from,
    target:edge.to,
    markerEnd:{type:MarkerType.ArrowClosed},
    animated:edge.type==="HARD",
    style:{strokeWidth:edge.type==="HARD"?2:1}
  })),[dependencies]);

  return (
    <>
      <div className="h-[520px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <ReactFlow nodes={nodes} edges={edges} fitView minZoom={0.4} maxZoom={1.5}>
          <Background />
          <Controls />
        </ReactFlow>
      </div>

      {selected?(
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30" onMouseDown={()=>setSelected(null)}>
          <aside className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-2xl" onMouseDown={event=>event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{selected.category}</p><h2 className="mt-1 text-2xl font-semibold">{selected.name}</h2></div>
              <button type="button" onClick={()=>setSelected(null)} className="rounded-lg border px-3 py-1.5 text-sm">Close</button>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Metric label="Capability" value={selected.level+(selected.currentScore==null?"":" · "+selected.currentScore.toFixed(2)+"/4")} />
              <Metric label="Confidence" value={Math.round(selected.confidence*100)+"%"} />
              <Metric label="Target" value={selected.targetScore.toFixed(1)+"/4"} />
              <Metric label="Priority" value={selected.priorityBand} />
            </div>

            <section className="mt-6"><h3 className="font-semibold">Why this matters</h3><p className="mt-2 text-sm leading-6 text-slate-600">{selected.rationale}</p></section>

            <section className="mt-6"><h3 className="font-semibold">Prerequisites</h3><div className="mt-2 space-y-2">{selected.prerequisites.length?selected.prerequisites.map(item=><div key={item.skillId} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"><span>{item.met?"✓":"○"}</span><span>{item.name}</span></div>):<p className="text-sm text-slate-500">No explicit prerequisites.</p>}</div></section>

            <section className="mt-6"><h3 className="font-semibold">Evidence found</h3><div className="mt-2 space-y-2">{selected.evidence.length?selected.evidence.slice(0,8).map(item=><div key={item.id} className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{item.source_type}</p><p className="mt-1 text-sm leading-6 text-slate-700">{item.claim}</p></div>):<p className="text-sm text-slate-500">No accepted evidence yet. SkillTwin treats this as uncertainty, not proof of zero ability.</p>}</div></section>

            <section className="mt-6 rounded-xl bg-indigo-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Recommended next action</p><p className="mt-1 font-medium">{selected.recommendedAction}</p></section>
            <div className="mt-5 flex flex-wrap gap-2"><Link href="/roadmap" className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white">Start learning</Link><Link href="/practice" className="rounded-xl border px-4 py-2 text-sm font-medium">Challenge this skill</Link></div>
          </aside>
        </div>
      ):null}
    </>
  );
}

function Metric({label,value}:{label:string;value:string}) {
  return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;
}
