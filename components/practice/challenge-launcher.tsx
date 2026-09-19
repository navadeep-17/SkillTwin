"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type SkillRec={
  skill_id:string;
  confidence:number;
  validationValue:number;
  priority_band:string;
  recommended_action:string;
  lastValidatedAt:string|null;
  questionCount:number;
  skills?:{canonical_name?:string;category?:string;slug?:string}|null;
};

export function ChallengeLauncher() {
  const router=useRouter();
  const [recommended,setRecommended]=useState<SkillRec|null>(null);
  const [skills,setSkills]=useState<SkillRec[]>([]);
  const [pending,setPending]=useState<string|null>(null);
  const [error,setError]=useState("");

  useEffect(()=>{
    fetch("/api/practice/recommendations",{cache:"no-store"})
      .then(r=>r.json())
      .then(payload=>{
        if(payload.ok){setRecommended(payload.data.recommended ?? null);setSkills(payload.data.skills ?? []);}
        else setError(payload.error?.message ?? "Could not load practice recommendations.");
      })
      .catch(()=>setError("Could not load practice recommendations."));
  },[]);

  async function startChallenge(skillId?:string,mode:"CHALLENGE_ME"|"CALIBRATION"="CHALLENGE_ME") {
    const key=(skillId ?? "auto")+":"+mode;
    setPending(key); setError("");
    try {
      const response=await fetch("/api/assessments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({targetSkillId:skillId,mode})});
      const payload=await response.json();
      if(!response.ok || !payload.ok){setError(payload.error?.message ?? "Could not start challenge.");return;}
      router.push("/practice/"+payload.data.assessment.id);
    } catch { setError("Could not start challenge."); }
    finally { setPending(null); }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-6 md:grid-cols-[1.2fr_.8fr] md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Recommended validation</p>
            <h2 className="mt-2 text-2xl font-semibold">{recommended?.skills?.canonical_name ?? "Challenge Me"}</h2>
            <p className="mt-3 text-slate-600">
              {recommended
                ? "Confidence "+Math.round(recommended.confidence*100)+"% · "+recommended.priority_band+" role priority · "+recommended.questionCount+" validated question-bank items available."
                : "SkillTwin will select the highest-value assessable role gap."}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Questions adapt concept and difficulty from temporary assessment belief. Canonical SkillTwin changes only after completion.
            </p>
            {error?<p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>:null}
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={()=>startChallenge(recommended?.skill_id)}
                disabled={pending!==null}
                className="rounded-xl bg-brand-600 px-5 py-2.5 font-medium text-white disabled:opacity-50"
              >
                {pending?.endsWith("CHALLENGE_ME")?"Preparing…":"Challenge Me"}
              </button>
              {recommended?<button
                type="button"
                onClick={()=>startChallenge(recommended.skill_id,"CALIBRATION")}
                disabled={pending!==null}
                className="rounded-xl border border-slate-300 px-5 py-2.5 font-medium"
              >
                {pending?.endsWith("CALIBRATION")?"Preparing…":"Calibration mode"}
              </button>:null}
            </div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-5">
            <p className="font-medium">Validation contract</p>
            <ol className="mt-3 space-y-2 text-sm text-slate-600">
              <li>1. Temporary assessment belief chooses the next concept/difficulty.</li>
              <li>2. MCQ is deterministic; text/scenario answers use a persisted rubric.</li>
              <li>3. Low evaluator confidence cannot create strong negative evidence.</li>
              <li>4. Completion emits question evidence plus one primary summary.</li>
            </ol>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Other skills worth validating</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {skills.length?skills.map(item=>(
            <div key={item.skill_id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div><p className="font-semibold">{item.skills?.canonical_name ?? "Skill"}</p><p className="mt-1 text-xs text-slate-500">{item.skills?.category ?? ""}</p></div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium">{Math.round(item.confidence*100)}% confidence</span>
              </div>
              <p className="mt-3 text-sm text-slate-600">Reason: {item.recommended_action} · {item.priority_band} priority</p>
              <p className="mt-1 text-xs text-slate-400">Last validated: {item.lastValidatedAt?new Date(item.lastValidatedAt).toLocaleDateString():"Not yet"}</p>
              <button type="button" onClick={()=>startChallenge(item.skill_id)} disabled={pending!==null} className="mt-4 rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50">Test this skill</button>
            </div>
          )):<p className="text-sm text-slate-500">No additional seeded validation banks match the current role gaps yet.</p>}
        </div>
      </section>
    </div>
  );
}
