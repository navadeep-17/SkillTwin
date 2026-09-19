"use client";

import { useEffect, useState } from "react";

type Recommendation={
  id:string;title:string;summary:string;technologies:unknown;requirements:unknown;milestones:unknown;success_criteria:unknown;
  estimated_minutes:number;difficulty:string;rationale:string;status:string;
};

const strings=(value:unknown)=>Array.isArray(value)?value.map(String):[];

export function ProjectRecommendationPanel(){
  const [current,setCurrent]=useState<Recommendation|null>(null);
  const [pending,setPending]=useState(false);
  const [message,setMessage]=useState("");

  useEffect(()=>{void load();},[]);
  async function load(){
    try{
      const response=await fetch("/api/projects/recommendation",{cache:"no-store"});
      const payload=await response.json();
      if(payload.ok) setCurrent(payload.data.current ?? null);
    }catch{}
  }
  async function generate(){
    setPending(true);setMessage("");
    try{
      const response=await fetch("/api/projects/recommendation",{method:"POST"});
      const payload=await response.json();
      if(!response.ok||!payload.ok){setMessage(payload.error?.message ?? "Could not generate project.");return;}
      setCurrent(payload.data.recommendation);
    }catch{setMessage("Could not generate project.");}
    finally{setPending(false);}
  }
  async function update(status:"STARTED"|"COMPLETED"|"DISMISSED"){
    if(!current)return;
    setPending(true);
    try{
      const response=await fetch("/api/projects/recommendation?id="+current.id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status})});
      const payload=await response.json();
      if(response.ok&&payload.ok){setCurrent(status==="DISMISSED"?null:payload.data.recommendation);setMessage(status==="STARTED"?"Marked as started. Submit your actual project evidence below when you have work to show.":"Recommendation updated.");}
      else setMessage(payload.error?.message ?? "Could not update recommendation.");
    }finally{setPending(false);}
  }

  if(!current){
    return <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-6"><p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Gap-targeted project</p><h2 className="mt-1 text-xl font-semibold">Turn multiple gaps into one build</h2><p className="mt-2 text-sm text-indigo-900">SkillTwin can create a bounded project brief from your latest role gaps. A recommendation alone never becomes skill evidence.</p>{message?<p className="mt-3 text-sm text-rose-700">{message}</p>:null}<button onClick={generate} disabled={pending} className="mt-4 rounded-xl bg-indigo-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{pending?"Generating…":"Recommend a project"}</button></section>;
  }

  return (
    <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Recommended · {current.difficulty}</p><h2 className="mt-1 text-2xl font-semibold">{current.title}</h2></div><span className="rounded-full bg-white/70 px-3 py-1 text-xs font-medium">{Math.round(current.estimated_minutes/60*10)/10}h</span></div>
      <p className="mt-3 leading-7 text-indigo-950">{current.summary}</p>
      <p className="mt-2 text-sm text-indigo-800">{current.rationale}</p>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <List title="Requirements" items={strings(current.requirements)} />
        <List title="Milestones" items={strings(current.milestones)} />
        <List title="Success criteria" items={strings(current.success_criteria)} />
        <List title="Suggested technologies" items={strings(current.technologies)} />
      </div>
      {message?<p className="mt-4 text-sm text-indigo-900">{message}</p>:null}
      <div className="mt-5 flex flex-wrap gap-2">
        {current.status==="ACTIVE"?<button disabled={pending} onClick={()=>update("STARTED")} className="rounded-xl bg-indigo-700 px-4 py-2 text-sm font-medium text-white">Start this project</button>:<span className="rounded-full bg-white px-3 py-2 text-sm font-medium">{current.status}</span>}
        <button disabled={pending} onClick={()=>update("DISMISSED")} className="rounded-xl border border-indigo-300 bg-white px-4 py-2 text-sm font-medium">Dismiss</button>
      </div>
    </section>
  );
}
function List({title,items}:{title:string;items:string[]}){return <div><h3 className="font-semibold">{title}</h3><ul className="mt-2 space-y-2 text-sm text-indigo-950">{items.map((item,index)=><li key={index} className="rounded-lg bg-white/60 px-3 py-2">{item}</li>)}</ul></div>;}
