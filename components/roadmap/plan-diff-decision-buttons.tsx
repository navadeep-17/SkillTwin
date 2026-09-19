"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PlanDiffDecisionButtons({diffId}:{diffId:string}){
  const router=useRouter();
  const [pending,setPending]=useState<"accept"|"reject"|null>(null);
  const [message,setMessage]=useState("");

  async function act(action:"accept"|"reject"){
    setPending(action);setMessage("");
    try{
      const response=await fetch("/api/roadmap/diffs/"+diffId+"/"+action,{method:"POST"});
      const payload=await response.json();
      if(!response.ok||!payload.ok){setMessage(payload.error?.message ?? "Could not update this proposal.");return;}
      if(action==="accept") router.push("/roadmap");
      else router.refresh();
    }catch{setMessage("Could not update this proposal.");}
    finally{setPending(null);}
  }

  return <div><div className="flex flex-wrap gap-2"><button disabled={pending!==null} onClick={()=>act("accept")} className="rounded-xl bg-brand-600 px-4 py-2 font-medium text-white disabled:opacity-50">{pending==="accept"?"Validating…":"Accept change"}</button><button disabled={pending!==null} onClick={()=>act("reject")} className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-medium disabled:opacity-50">{pending==="reject"?"Keeping…":"Keep current plan"}</button></div>{message?<p className="mt-2 text-sm text-rose-700">{message}</p>:null}</div>;
}
