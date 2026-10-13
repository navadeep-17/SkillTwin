"use client";

import Link from "next/link";
import { useMemo,useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight, CheckCircle2, ChevronRight, CircleAlert, FileCheck2,
  Fingerprint, History, LoaderCircle, LockKeyhole, Search,
  ShieldCheck, Sparkles, Target, TrendingUp, Zap
} from "lucide-react";
import {
  evidenceReliabilityLabel,normalizedConfidence,
  type TwinEvidence,type TwinProofTrail
} from "@/lib/domain/twin-challenge";

export type TwinChallengeSkill={
  id:string;
  name:string;
  category:string;
  description:string;
  level:string;
  capability:number|null;
  confidence:number|null;
  conflict:string;
  evidenceCount:number;
  lastValidatedAt:string|null;
  questionCount:number;
  activeAssessmentId:string|null;
  availability:"RESUME"|"READY"|"NO_VALIDATED_BANK";
  evidence:TwinEvidence[];
  proof:TwinProofTrail|null;
};

type Concern="OVERESTIMATED"|"UNDERESTIMATED"|"UNCERTAIN";
const concerns:[
  {value:Concern,title:string,detail:string},
  {value:Concern,title:string,detail:string},
  {value:Concern,title:string,detail:string}
]=[
  {value:"UNDERESTIMATED",title:"I'm more capable than this",detail:"Prove that my estimate may be too low."},
  {value:"OVERESTIMATED",title:"My estimate may be too high",detail:"Check whether my evidence overstates my ability."},
  {value:"UNCERTAIN",title:"I'm not sure yet",detail:"Validate my current ability with fresh evidence."}
];
const asLabel=(value:string)=>value.replaceAll("_"," ").toLowerCase().replace(/\b\w/g,x=>x.toUpperCase());

export function TwinChallengeWorkbench({skills,initialSkillId}:{
  skills:TwinChallengeSkill[];
  initialSkillId?:string;
}) {
  const router=useRouter();
  const defaultSkill=initialSkillId??skills.find(s=>s.evidenceCount>0&&s.availability!=="NO_VALIDATED_BANK")?.id
    ??skills.find(s=>s.availability!=="NO_VALIDATED_BANK")?.id??skills[0]?.id??"";
  const [selectedId,setSelectedId]=useState(defaultSkill);
  const [search,setSearch]=useState("");
  const [view,setView]=useState<"ALL"|"ESTIMATED"|"PROOF_READY">("PROOF_READY");
  const [concern,setConcern]=useState<Concern>("UNDERESTIMATED");
  const [pending,setPending]=useState(false);
  const [error,setError]=useState("");
  const selected=skills.find(s=>s.id===selectedId)??skills[0]??null;
  const filtered=useMemo(()=>skills.filter(s=>{
    if(view==="ESTIMATED"&&s.evidenceCount===0)return false;
    if(view==="PROOF_READY"&&s.availability==="NO_VALIDATED_BANK")return false;
    const q=search.toLowerCase().trim();
    return !q||s.name.toLowerCase().includes(q)||s.category.toLowerCase().includes(q);
  }),[skills,search,view]);

  async function startProof(skill:TwinChallengeSkill) {
    if(skill.activeAssessmentId) {
      router.push("/practice/"+skill.activeAssessmentId);
      return;
    }
    if(skill.availability!=="READY"||pending)return;
    setError("");
    setPending(true);
    try {
      const response=await fetch("/api/assessments",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({mode:"CHALLENGE_ME",targetSkillId:skill.id})
      });
      const payload=await response.json();
      if(!response.ok||!payload.ok||!payload.data?.assessment?.id) {
        setError(payload.error?.message??"The proof challenge could not start. Try again later.");
        return;
      }
      router.push("/practice/"+payload.data.assessment.id);
    } catch {
      setError("Unable to start the challenge. Your existing evidence has not changed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <header className="mt-6 max-w-4xl">
        <p className="eyebrow">The challengeable AI career twin</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
          Challenge My Twin
        </h1>
        <p className="mt-3 text-[15px] leading-7 text-slate-600">
          Your SkillTwin makes an estimate from available evidence. You are allowed to question it.
          Inspect the sources, select what you think may be wrong, and demonstrate your
          knowledge in a targeted assessment. The results—not your assertion—determine any update.
        </p>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="Proof challenge readiness">
        <Stat number={String(skills.filter(s=>s.evidenceCount>0).length)} label="Skills with recorded evidence" />
        <Stat number={String(skills.filter(s=>s.questionCount>=4).length)} label="Skills with a validated challenge bank" />
        <Stat number={String(skills.filter(s=>Boolean(s.proof)).length)} label="Skills with a completed proof" />
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
        <aside className="space-y-3" aria-label="Choose a skill to question">
          <div className="surface-card p-4">
            <label htmlFor="twin-skill-search" className="text-xs font-semibold uppercase tracking-wider text-slate-500">Find a skill</label>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400" />
              <input id="twin-skill-search" value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="Python, SQL, communication…" className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm focus:border-brand-400 focus:outline-none" />
            </div>
            <label htmlFor="twin-skill-filter" className="mt-4 block text-xs font-semibold uppercase tracking-wider text-slate-500">Show skills</label>
            <select id="twin-skill-filter" value={view} onChange={e=>setView(e.target.value as "ALL"|"ESTIMATED"|"PROOF_READY")}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
              <option value="PROOF_READY">Proof-ready challenges</option>
              <option value="ESTIMATED">My recorded skills</option>
              <option value="ALL">All catalog skills</option>
            </select>
          </div>
          <div className="space-y-2">
            {filtered.map(skill=>(
              <button key={skill.id} type="button"
                aria-pressed={selected?.id===skill.id} aria-controls="challenge-my-twin-details"
                onClick={()=>{
                  setSelectedId(skill.id);setError("");setConcern("UNDERESTIMATED");
                  if(window.innerWidth<1024) document.getElementById("challenge-my-twin-details")?.scrollIntoView({behavior:"smooth",block:"start"});
                }}
                className={"w-full rounded-xl border p-4 text-left transition " +
                  (selected?.id===skill.id?"border-brand-400 bg-brand-50/60 shadow-sm":"border-slate-200 bg-white hover:border-brand-200 hover:bg-slate-50")}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{skill.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{skill.category} · {asLabel(skill.level)}</p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-brand-500"/>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {skill.availability==="RESUME"?"Challenge in progress":
                    skill.availability==="READY"?"Proof challenge available":"No validated challenge bank yet"}
                </p>
              </button>
            ))}
            {!filtered.length&&<div className="surface-card p-5 text-sm text-slate-600">
              No matching skills in this filter. Try All catalog skills.
            </div>}
          </div>
        </aside>

        <section id="challenge-my-twin-details" className="scroll-mt-6">
          {selected ? (
            <div className="surface-card overflow-hidden">
              <div className="border-b border-slate-200 bg-slate-50/70 p-6 sm:p-7">
                <p className="eyebrow">{selected.category} · Your current skill estimate</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{selected.name}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{selected.description||"Skill from the SkillTwin taxonomy."}</p>
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Metric title="Current estimate" value={asLabel(selected.level)} />
                  <Metric title="Evidence confidence" value={normalizedConfidence(selected.confidence)!=null?normalizedConfidence(selected.confidence)+"%":"Unknown"} />
                  <Metric title="Evidence count" value={String(selected.evidenceCount)} />
                </div>
                {selected.conflict==="UNRESOLVED"?(
                  <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <CircleAlert className="mr-2 inline size-4"/>Your sources disagree. An assessment may help clarify the estimate.
                  </p>
                ):null}
                <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0"/>
                  Skill level and confidence are separate estimates. Unknown is not zero; neither is a hiring or certification decision.
                </p>
              </div>

              <div className="space-y-7 p-6 sm:p-7">
                <section>
                  <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                    <Fingerprint className="size-5 text-brand-600"/> Why SkillTwin currently believes this
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Recent evidence in your own account. A resume mention is weaker proof than a completed assessed challenge.
                  </p>
                  {selected.evidence.length ? (
                    <ul className="mt-3 space-y-2">
                      {selected.evidence.map(item=>(
                        <li key={item.source_type+":"+item.created_at+":"+item.claim} className="rounded-xl border border-slate-200 bg-white p-3">
                          <p className="text-xs font-semibold text-brand-700">{evidenceReliabilityLabel(item.source_type)}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-700 break-words">{item.claim}</p>
                        </li>
                      ))}
                    </ul>
                  ):<p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                    No accepted evidence is recorded for this skill. SkillTwin cannot make a confident claim yet.
                  </p>}
                </section>

                <section className="rounded-2xl border border-brand-100 bg-brand-50/30 p-4 sm:p-5">
                  <div className="flex items-center gap-2">
                    <Zap className="size-5 text-brand-600"/>
                    <h3 className="text-base font-semibold text-slate-900">What do you want to challenge?</h3>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-600">
                    Choose your concern. It personalizes this interaction only; the evaluator does not receive
                    your preferred direction and will not award points for agreeing with you.
                  </p>
                  <div className="mt-4 space-y-2" role="group" aria-label="How do you disagree with your skill estimate?">
                    {concerns.map(item=>(
                      <button key={item.value} type="button" aria-pressed={concern===item.value}
                        onClick={()=>setConcern(item.value)}
                        className={"w-full rounded-xl border p-3 text-left transition "+
                          (concern===item.value?"border-brand-400 bg-white shadow-sm":"border-slate-200 bg-white/80 hover:border-brand-200")}>
                        <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
                      </button>
                    ))}
                  </div>
                  {selected.availability==="NO_VALIDATED_BANK" ? (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                      <LockKeyhole className="mr-2 inline size-4"/>
                      This skill does not yet have four validated questions in the bank.
                      We won't fabricate an assessment to support your claim.
                    </div>
                  ) : (
                    <button type="button" onClick={()=>void startProof(selected)} disabled={pending}
                      className="btn-primary mt-4 w-full justify-center sm:w-auto">
                      {pending?<LoaderCircle className="size-4 animate-spin"/>:<Target className="size-4"/>}
                      {pending?"Preparing proof challenge":selected.availability==="RESUME"?"Resume my proof challenge":"Prove what I know"}
                      {!pending?<ArrowRight className="size-4"/>:null}
                    </button>
                  )}
                  {error?<p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>:null}
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    An assessment uses SkillTwin's existing question bank and evidence engine. Your skill state changes
                    only if the completed result supplies qualifying new evidence.
                  </p>
                </section>

                <section aria-label="Latest proof trail">
                  <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                    <History className="size-5 text-brand-600"/> What did the last proof change?
                  </h3>
                  {selected.proof?<ProofTrail proof={selected.proof}/>:(
                    <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                      No completed proof challenge is recorded for this skill yet. Finish an assessment to see a traceable outcome here.
                    </p>
                  )}
                </section>
              </div>
            </div>
          ):<div className="surface-card p-8 text-sm text-slate-600">No skill catalog entries are available.</div>}
        </section>
      </div>
      <footer className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-6 text-slate-500">
        <FileCheck2 className="mr-2 inline size-4 text-brand-600"/>
        Private to your account. Claims, assessments, decisions and evidence are displayed from stored
        learner records. This page does not create skill assessments on its own or alter your goal when you select a concern.
        <Link className="ml-2 font-semibold text-brand-700 underline" href="/passport">Open Evidence Passport</Link>
      </footer>
    </>
  );
}

function Stat({number,label}:{number:string;label:string}) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4">
    <p className="text-2xl font-semibold text-slate-950">{number}</p>
    <p className="mt-1 text-xs text-slate-600">{label}</p>
  </div>;
}
function Metric({title,value}:{title:string;value:string}) {
  return <div className="rounded-xl border border-slate-200 bg-white p-3">
    <p className="text-xs text-slate-500">{title}</p>
    <p className="mt-1 text-base font-semibold text-slate-900">{value}</p>
  </div>;
}

function ProofTrail({proof}:{proof:TwinProofTrail}) {
  return (
    <div className="mt-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Metric title="Recorded assessment score" value={proof.scorePercent!=null?proof.scorePercent+"%":"Not recorded"} />
        <Metric title="Concept coverage" value={proof.coveragePercent!=null?proof.coveragePercent+"%":"Not recorded"} />
      </div>
      {proof.before&&proof.after?(
        <div className="rounded-xl border border-brand-100 bg-brand-50/30 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900"><TrendingUp className="size-4 text-brand-600"/> SkillTwin before → after</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs text-slate-500">Before</p>
              <p className="mt-1 text-sm font-semibold text-slate-700">{proof.before.level?asLabel(proof.before.level):"Unknown"}</p>
              <p className="mt-1 text-xs text-slate-500">Confidence {proof.before.confidencePercent==null?"Unknown":proof.before.confidencePercent+"%"}</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs text-slate-500">After</p>
              <p className="mt-1 text-sm font-semibold text-brand-700">{proof.after.level?asLabel(proof.after.level):"Unknown"}</p>
              <p className="mt-1 text-xs text-slate-500">Confidence {proof.after.confidencePercent==null?"Unknown":proof.after.confidencePercent+"%"}</p>
            </div>
          </div>
          {proof.skillExplanation?<p className="mt-3 text-xs leading-5 text-slate-600">{proof.skillExplanation}</p>:null}
        </div>
      ):<div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Assessment outcome exists, but no matching material skill-history change was recorded for that assessment.
      </div>}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">
          {proof.planStatus==="CHANGED"?"Roadmap change recorded":
            proof.planStatus==="UNCHANGED"?"Roadmap unchanged by design":"Roadmap decision not confirmed"}
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">{proof.planReason}</p>
        {proof.planDiffId?<Link href={"/roadmap/changes/"+proof.planDiffId} className="quiet-link mt-3 inline-flex items-center gap-1">
          View recorded PlanDiff <ArrowRight className="size-4"/>
        </Link>:null}
        <p className="mt-2 text-xs text-slate-500">Linked by this assessment's saved trigger reference, not by a guessed timeline.</p>
      </div>
      <Link href={"/practice/"+proof.assessmentId} className="quiet-link inline-flex items-center gap-2">
        <CheckCircle2 className="size-4"/> Review the completed assessment <ArrowRight className="size-4"/>
      </Link>
    </div>
  );
}
