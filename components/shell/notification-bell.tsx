"use client";

import { useEffect, useMemo, useState } from "react";

type EventRow={id:string;event_type:string;summary:string;created_at:string};
const HIGH_VALUE=new Set([
  "plan.adapted",
  "assessment.completed",
  "project.recommendation.created",
  "plan.undo.applied",
  "role.custom.created"
]);

function readDismissed(){
  if(typeof window==="undefined") return new Set<string>();
  try{return new Set<string>(JSON.parse(localStorage.getItem("skilltwin:dismissed-notifications") ?? "[]"));}catch{return new Set<string>();}
}
function writeDismissed(ids:Set<string>){
  localStorage.setItem("skilltwin:dismissed-notifications",JSON.stringify([...ids].slice(-200)));
}

export function NotificationBell(){
  const [open,setOpen]=useState(false);
  const [events,setEvents]=useState<EventRow[]>([]);
  const [dismissed,setDismissed]=useState<Set<string>>(new Set());
  const [enabled,setEnabled]=useState(true);

  useEffect(()=>{
    setDismissed(readDismissed());
    Promise.all([
      fetch("/api/agent-events?limit=20",{cache:"no-store"}).then(r=>r.json()),
      fetch("/api/settings",{cache:"no-store"}).then(r=>r.json())
    ]).then(([activity,settings])=>{
      if(activity.ok) setEvents((activity.data.events ?? []).filter((event:EventRow)=>HIGH_VALUE.has(event.event_type)));
      if(settings.ok) setEnabled(Boolean(settings.data.settings?.notifications_enabled ?? true));
    }).catch(()=>{});
  },[]);

  const visible=useMemo(()=>events.filter(event=>!dismissed.has(event.id)),[events,dismissed]);
  if(!enabled) return null;

  function dismiss(id:string){
    setDismissed(current=>{
      const next=new Set(current);next.add(id);writeDismissed(next);return next;
    });
  }

  return (
    <div className="relative shrink-0">
      <button type="button" aria-label="Notifications" onClick={()=>setOpen(value=>!value)} className="relative rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
        Bell
        {visible.length?<span className="ml-2 rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] text-white">{Math.min(visible.length,9)}</span>:null}
      </button>
      {open?<div className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="border-b px-4 py-3"><p className="font-semibold">Notifications</p><p className="mt-0.5 text-xs text-slate-500">Attention cues only; Agent Activity remains the durable audit log.</p></div>
        <div className="max-h-96 overflow-y-auto p-2">
          {visible.length?visible.map(event=><div key={event.id} className="rounded-xl p-3 hover:bg-slate-50">
            <div className="flex items-start justify-between gap-3"><p className="text-sm font-medium">{event.summary}</p><button type="button" onClick={()=>dismiss(event.id)} className="shrink-0 text-xs text-slate-400 hover:text-slate-700">Dismiss</button></div>
            <p className="mt-1 text-[11px] text-slate-400">{new Date(event.created_at).toLocaleString()}</p>
          </div>):<p className="p-4 text-center text-sm text-slate-500">No new high-value notifications.</p>}
        </div>
      </div>:null}
    </div>
  );
}
