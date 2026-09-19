"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { JourneyChat } from "@/components/journey/journey-chat";

type EventItem={
  id:string;event_type:string;trigger_type:string|null;summary:string;entity_refs:unknown;evidence_refs:unknown;metadata:unknown;created_at:string;
};

export function GlobalAgentToolsClient(){
  const [open,setOpen]=useState<"chat"|"activity"|null>(null);
  const [events,setEvents]=useState<EventItem[]>([]);
  const [selected,setSelected]=useState<Record<string,unknown>|null>(null);
  const [loading,setLoading]=useState(false);

  useEffect(()=>{
    if(open!=="activity" || events.length) return;
    setLoading(true);
    fetch("/api/agent-events?limit=20",{cache:"no-store"})
      .then(r=>r.json())
      .then(payload=>{if(payload.ok)setEvents(payload.data.events ?? []);})
      .finally(()=>setLoading(false));
  },[open,events.length]);

  async function openEvent(id:string){
    setLoading(true);
    try{
      const response=await fetch("/api/agent-events/"+id,{cache:"no-store"});
      const payload=await response.json();
      if(response.ok&&payload.ok)setSelected(payload.data);
    }finally{setLoading(false);}
  }

  return (
    <>
      <div className="fixed bottom-5 right-5 z-40 flex gap-2">
        <button onClick={()=>setOpen(open==="activity"?null:"activity")} className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold shadow-lg">Activity</button>
        <button onClick={()=>setOpen(open==="chat"?null:"chat")} className="rounded-full bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-lg">Ask SkillTwin</button>
      </div>

      {open?(
        <div className="fixed inset-0 z-50 bg-slate-950/30" onMouseDown={()=>{setOpen(null);setSelected(null);}}>
          <aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto bg-slate-50 shadow-2xl" onMouseDown={event=>event.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4">
              <div><p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{open==="chat"?"Journey Chat":"Agent Activity"}</p><p className="font-semibold">{open==="chat"?"Grounded in your current SkillTwin":"Observable committed actions only"}</p></div>
              <button onClick={()=>{setOpen(null);setSelected(null);}} className="rounded-lg border px-3 py-1.5 text-sm">Close</button>
            </div>

            <div className="p-4">
              {open==="chat"?<JourneyChat />:selected?(
                <div>
                  <button onClick={()=>setSelected(null)} className="text-sm font-medium text-brand-700">← Activity feed</button>
                  <EventDetail data={selected} />
                </div>
              ):(
                <div className="space-y-3">
                  {loading&&!events.length?<p className="p-4 text-sm text-slate-500">Loading activity…</p>:null}
                  {events.map(event=><button key={event.id} type="button" onClick={()=>openEvent(event.id)} className="w-full rounded-xl border bg-white p-4 text-left hover:border-brand-300"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{event.event_type}</p><p className="mt-1 text-sm font-medium">{event.summary}</p></div><time className="shrink-0 text-[10px] text-slate-400">{new Date(event.created_at).toLocaleDateString()}</time></div></button>)}
                  <Link href="/activity" className="inline-flex text-sm font-medium text-brand-700">Open full activity history →</Link>
                </div>
              )}
            </div>
          </aside>
        </div>
      ):null}
    </>
  );
}

function EventDetail({data}:{data:Record<string,unknown>}){
  const event=data.event && typeof data.event==="object"?data.event as Record<string,unknown>:{};
  const details=data.details && typeof data.details==="object"?data.details as Record<string,unknown>:{};
  return (
    <div className="mt-5 space-y-5">
      <section className="rounded-2xl border bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{String(event.event_type ?? "event")}</p><h2 className="mt-2 text-xl font-semibold">{String(event.summary ?? "")}</h2><div className="mt-3 space-y-1 text-sm text-slate-500"><p>Trigger: {String(event.trigger_type ?? "—")}</p><p>Trigger ref: {String(event.trigger_ref ?? "—")}</p><p>{event.created_at?new Date(String(event.created_at)).toLocaleString():""}</p></div></section>
      {Object.entries(details).map(([label,value])=><section key={label} className="rounded-2xl border bg-white p-5"><h3 className="font-semibold">{humanize(label)}</h3><pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">{JSON.stringify(value,null,2)}</pre></section>)}
      <p className="text-xs leading-5 text-slate-400">{String(data.explanationBoundary ?? "")}</p>
    </div>
  );
}
function humanize(value:string){return value.replace(/([A-Z])/g," $1").replace(/^./,c=>c.toUpperCase());}
