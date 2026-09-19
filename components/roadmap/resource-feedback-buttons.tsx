"use client";

import Link from "next/link";
import { useState } from "react";

const signals=[
  ["HELPFUL","Helpful"],
  ["NOT_HELPFUL","Not helpful"],
  ["TOO_EASY","Too easy"],
  ["TOO_HARD","Too hard"],
  ["TOO_LONG","Too long"],
  ["PREFERRED_FORMAT","I prefer this format"]
] as const;

export function ResourceFeedbackButtons({resourceId,taskId}:{resourceId:string;taskId:string}){
  const [pending,setPending]=useState<string|null>(null);
  const [message,setMessage]=useState("");
  const [diffId,setDiffId]=useState<string|null>(null);

  async function send(signal:(typeof signals)[number][0]){
    setPending(signal);setMessage("");setDiffId(null);
    try{
      const response=await fetch("/api/resources/"+resourceId+"/feedback",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({taskId,signal})
      });
      const payload=await response.json();
      if(!response.ok||!payload.ok) throw new Error(payload.error?.message ?? "Could not save resource feedback.");
      const replan=payload.data?.replan;
      const nextDiff=replan?.changed && replan?.diff?.diffId ? String(replan.diff.diffId) : null;
      setDiffId(nextDiff);
      setMessage(nextDiff
        ? (replan.diff.status==="PROPOSED"?"SkillTwin proposed a verified-resource change.":"SkillTwin applied a verified-resource change.")
        : "Feedback saved. No material roadmap change was required.");
    }catch(error){
      setMessage(error instanceof Error?error.message:"Could not save resource feedback.");
    }finally{setPending(null);}
  }

  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resource feedback</p>
      <p className="mt-1 text-xs text-slate-500">This affects planning/resource matching only. It does not lower your skill estimate.</p>
      <div className="mt-3 flex flex-wrap gap-2">{signals.map(([signal,label])=><button key={signal} type="button" disabled={pending!==null} onClick={()=>void send(signal)} className="rounded-lg border bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-50">{pending===signal?"Saving…":label}</button>)}</div>
      {message?<p className="mt-3 text-xs text-slate-600">{message}</p>:null}
      {diffId?<Link href={"/roadmap/changes/"+diffId} className="mt-2 inline-flex text-xs font-semibold text-brand-700">See What Changed →</Link>:null}
    </div>
  );
}
