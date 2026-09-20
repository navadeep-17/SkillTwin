"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetOwnDemoState } from "@/app/actions/demo-reset";

export function DemoResetControl(){
  const router=useRouter();
  const [pending,startTransition]=useTransition();
  const [message,setMessage]=useState("");

  function reset(){
    if(pending) return;
    if(!window.confirm("Reset this signed-in learner to the verified SkillTwin demo baseline?")) return;
    setMessage("");

    startTransition(async()=>{
      const result=await resetOwnDemoState();
      if(!result.ok){
        setMessage(result.error ?? "Could not reset and verify the demo learner.");
        return;
      }
      setMessage("DEMO READY. The deterministic baseline passed invariant verification.");
      router.push("/overview");
      router.refresh();
    });
  }

  return (
    <div className="max-w-xl">
      <p className="text-sm text-amber-950">
        This clears only the currently signed-in learner state, rebuilds the deterministic demo baseline through canonical services, and verifies invariants before reporting success.
      </p>
      <button
        type="button"
        onClick={reset}
        disabled={pending}
        className="mt-3 rounded-xl bg-amber-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending?"Resetting and verifying…":"Reset learner to demo baseline"}
      </button>
      {message?<p className={"mt-3 text-sm "+(message.startsWith("DEMO READY")?"text-emerald-700":"text-rose-700")}>{message}</p>:null}
    </div>
  );
}
