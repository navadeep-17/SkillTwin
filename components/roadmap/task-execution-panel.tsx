"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TaskExecutionPanel({task}:{task:{id:string;type:string;status:string;dueAt:string|null;actualMinutes:number|null}}) {
  const router=useRouter();
  const [status,setStatus]=useState(task.status);
  const [actual,setActual]=useState(task.actualMinutes ?? "");
  const [dueAt,setDueAt]=useState(task.dueAt?new Date(task.dueAt).toISOString().slice(0,16):"");
  const [message,setMessage]=useState("");
  const [pending,setPending]=useState(false);

  async function update(nextStatus:string) {
    setPending(true); setMessage("");
    try {
      if(task.type==="VALIDATE" && nextStatus==="COMPLETED"){
        const response=await fetch("/api/tasks/"+task.id+"/validate",{method:"POST"});
        const payload=await response.json();
        if(!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "Could not start validation.");
        router.push(payload.ui_effects?.next_action?.href ?? "/practice"); return;
      }
      const response=await fetch("/api/tasks/"+task.id+"/status",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:nextStatus,actualMinutes:actual===""?null:Number(actual),dueAt:dueAt?new Date(dueAt).toISOString():null})});
      const payload=await response.json();
      if(!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "Could not update task.");
      setStatus(nextStatus); setMessage("Task state updated."); router.refresh();
    } catch(error){setMessage(error instanceof Error?error.message:"Could not update task.");}
    finally{setPending(false);}
  }

  return (
    <div className="rounded-2xl border bg-white p-5">
      <div className="grid gap-4 sm:grid-cols-2"><label><span className="text-sm font-medium">Actual minutes</span><input type="number" min={0} value={actual} onChange={e=>setActual(e.target.value===""?"":Number(e.target.value))} className="mt-1 w-full rounded-xl border px-3 py-2" /></label><label><span className="text-sm font-medium">Due time</span><input type="datetime-local" value={dueAt} onChange={e=>setDueAt(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" /></label></div>
      <div className="mt-4 flex flex-wrap gap-2">
        {status==="PLANNED"?<button disabled={pending} onClick={()=>update("IN_PROGRESS")} className="rounded-xl border px-4 py-2 text-sm font-medium">Start task</button>:null}
        {status!=="COMPLETED"?<button disabled={pending} onClick={()=>update("COMPLETED")} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white">{task.type==="VALIDATE"?"Start validation":"Complete task"}</button>:<span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">Completed</span>}
        {status!=="COMPLETED"&&status!=="SKIPPED"?<button disabled={pending} onClick={()=>update("SKIPPED")} className="rounded-xl border px-4 py-2 text-sm font-medium">Skip</button>:null}
        {status!=="COMPLETED"?<button disabled={pending} onClick={()=>update(status)} className="rounded-xl border px-4 py-2 text-sm font-medium">Save timing</button>:null}
      </div>
      {message?<p className="mt-3 text-sm text-slate-600">{message}</p>:null}
    </div>
  );
}
