"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type RoleOption={id:string;slug:string;name:string;family:string|null;roleVersionId:string;source:string};
type Goal=Record<string,unknown>|null;
const DAYS=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

export function OnboardingFlow({
  roles,initialGoal,displayName,initialStep
}:{roles:RoleOption[];initialGoal:Goal;displayName:string;initialStep:number}) {
  const router=useRouter();
  const initialRoleVersion=String(initialGoal?.role_version_id ?? roles[0]?.roleVersionId ?? "");
  const [step,setStep]=useState(initialGoal ? Math.max(1,initialStep) : 1);
  const [roleOptions,setRoleOptions]=useState(roles);
  const [roleVersionId,setRoleVersionId]=useState(initialRoleVersion);
  const [goalId,setGoalId]=useState(initialGoal?.id ? String(initialGoal.id) : "");
  const [careerObjective,setCareerObjective]=useState(String(initialGoal?.career_objective ?? ""));
  const [goalDescription,setGoalDescription]=useState(String(initialGoal?.goal_description ?? ""));
  const [experienceLevel,setExperienceLevel]=useState(String(initialGoal?.experience_level ?? "BEGINNER"));
  const [targetDate,setTargetDate]=useState(String(initialGoal?.target_date ?? ""));
  const [hours,setHours]=useState(Number(initialGoal?.hours_per_week ?? 10));
  const [session,setSession]=useState(Number(initialGoal?.preferred_session_minutes ?? 60));
  const [days,setDays]=useState<string[]>(Array.isArray(initialGoal?.learning_days) ? initialGoal!.learning_days as string[] : ["Mon","Tue","Wed","Thu","Fri","Sat"]);
  const [formats,setFormats]=useState<string[]>(Array.isArray(initialGoal?.preferred_formats) ? initialGoal!.preferred_formats as string[] : ["projects","practice","documentation"]);
  const [adaptation,setAdaptation]=useState(String(initialGoal?.adaptation_mode ?? "AUTOMATIC"));
  const [resume,setResume]=useState<File|null>(null);
  const [documentId,setDocumentId]=useState("");
  const [projectTitle,setProjectTitle]=useState("");
  const [projectDescription,setProjectDescription]=useState("");
  const [projectTechnologies,setProjectTechnologies]=useState("");
  const [customRoleName,setCustomRoleName]=useState("");
  const [customPending,setCustomPending]=useState(false);
  const [pending,setPending]=useState(false);
  const [message,setMessage]=useState("");
  const [analysisStage,setAnalysisStage]=useState<string[]>([]);

  const role=useMemo(()=>roleOptions.find(x=>x.roleVersionId===roleVersionId),[roleOptions,roleVersionId]);

  async function saveGoal() {
    setPending(true); setMessage("");
    try {
      const payload={roleVersionId,careerObjective:careerObjective||null,goalDescription:goalDescription||null,experienceLevel,targetDate:targetDate||null,hoursPerWeek:hours,preferredSessionMinutes:session,minSessionMinutes:Math.min(20,session),learningDays:days,preferredFormats:formats,adaptationMode:adaptation};
      let response:Response;
      if (goalId && String(initialGoal?.role_version_id ?? "")===roleVersionId) {
        response=await fetch("/api/goals/"+goalId,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      } else {
        response=await fetch("/api/goals",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      }
      const result=await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error?.message ?? "Could not save career goal.");
      setGoalId(String(result.data.goal.id));
      setStep(2);
    } catch (error) { setMessage(error instanceof Error?error.message:"Could not save career goal."); }
    finally { setPending(false); }
  }

  async function createCustomRole() {
    if (customRoleName.trim().length<2) return;
    setCustomPending(true); setMessage("");
    try {
      const response=await fetch("/api/roles/custom",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({roleName:customRoleName,levelContext:"ENTRY",goalDescription})});
      const result=await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error?.message ?? "Custom role generation failed.");
      const option:RoleOption={id:String(result.data.roleId),slug:String(result.data.slug),name:String(result.data.name),family:"Custom",roleVersionId:String(result.data.roleVersionId),source:"AI_GENERATED"};
      setRoleOptions(current=>[...current,option]); setRoleVersionId(option.roleVersionId); setCustomRoleName("");
    } catch (error) { setMessage(error instanceof Error?error.message:"Custom role generation failed."); }
    finally { setCustomPending(false); }
  }

  async function uploadProfile() {
    setPending(true); setMessage("");
    try {
      if (resume) {
        const form=new FormData(); form.set("file",resume);
        const response=await fetch("/api/profile/documents",{method:"POST",body:form});
        const result=await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error?.message ?? "Resume upload failed.");
        setDocumentId(String(result.data.document.id));
      }
      setStep(3);
    } catch (error) { setMessage(error instanceof Error?error.message:"Profile upload failed."); }
    finally { setPending(false); }
  }

  async function savePreferences() {
    if (!goalId) return;
    setPending(true); setMessage("");
    try {
      const response=await fetch("/api/goals/"+goalId,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({hoursPerWeek:hours,preferredSessionMinutes:session,learningDays:days,preferredFormats:formats,adaptationMode:adaptation})});
      const result=await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error?.message ?? "Could not save preferences.");
      setStep(4); void runAnalysis();
    } catch (error) { setMessage(error instanceof Error?error.message:"Could not save preferences."); }
    finally { setPending(false); }
  }

  async function runAnalysis() {
    setPending(true); setMessage(""); setAnalysisStage(["Goal and learning constraints saved"]);
    try {
      if (projectTitle.trim() && projectDescription.trim().length>=20) {
        setAnalysisStage(current=>[...current,"Analyzing project evidence"]);
        const response=await fetch("/api/profile/projects",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:projectTitle,description:projectDescription,technologies:projectTechnologies.split(",").map(x=>x.trim()).filter(Boolean),artifactUrl:null})});
        const result=await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error?.message ?? "Project analysis failed.");
        setAnalysisStage(current=>[...current,"Project evidence committed to SkillTwin"]);
      }
      if (documentId) {
        setAnalysisStage(current=>[...current,"Parsing and segmenting resume","Mapping source-backed skill evidence"]);
        const response=await fetch("/api/profile/documents/"+documentId+"/analyze",{method:"POST"});
        const result=await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error?.message ?? "Resume analysis failed.");
        setAnalysisStage(current=>[...current,"SkillTwin capability/confidence updated","Role gaps and readiness recomputed","Learning roadmap generated"]);
      } else {
        setAnalysisStage(current=>[...current,"No resume supplied; using available project/manual evidence","Role gaps and readiness recomputed"]);
      }
      await fetch("/api/onboarding/complete",{method:"POST"});
      setAnalysisStage(current=>[...current,"Onboarding complete"]);
    } catch (error) {
      setMessage(error instanceof Error?error.message:"Analysis failed.");
    } finally { setPending(false); }
  }

  function toggleDay(day:string){setDays(current=>current.includes(day)?(current.length>1?current.filter(x=>x!==day):current):[...current,day]);}
  function toggleFormat(format:string){setFormats(current=>current.includes(format)?(current.length>1?current.filter(x=>x!==format):current):[...current,format]);}

  return (
    <section>
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">SkillTwin onboarding</p>
      <h1 className="mt-2 text-3xl font-semibold">Build a learner model that evolves with you</h1>
      <p className="mt-2 text-slate-600">Welcome {displayName || "learner"}. Capability evidence stays separate from your target-role preferences.</p>

      <div className="mt-6 grid grid-cols-4 gap-2">
        {["Goal","Profile","Preferences","Analysis"].map((label,index)=><div key={label}><div className={step>=index+1?"h-2 rounded-full bg-brand-600":"h-2 rounded-full bg-slate-200"} /><p className="mt-1 text-xs text-slate-500">{index+1}. {label}</p></div>)}
      </div>

      {message?<p className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{message}</p>:null}

      {step===1?(
        <div className="mt-8 space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Choose your target role</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{roleOptions.map(option=><button type="button" key={option.roleVersionId} onClick={()=>setRoleVersionId(option.roleVersionId)} className={roleVersionId===option.roleVersionId?"rounded-2xl border-2 border-brand-500 bg-indigo-50 p-4 text-left":"rounded-2xl border border-slate-200 bg-white p-4 text-left"}><strong>{option.name}</strong><p className="mt-1 text-sm text-slate-500">{option.family} · {option.source==="AI_GENERATED"?"Custom":"Seeded"}</p></button>)}</div>
          </div>
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5">
            <p className="font-medium">Need a different role?</p>
            <div className="mt-3 flex gap-2"><input value={customRoleName} onChange={e=>setCustomRoleName(e.target.value)} placeholder="e.g. Cybersecurity Analyst" className="min-w-0 flex-1 rounded-xl border px-3 py-2" /><button type="button" onClick={createCustomRole} disabled={customPending||customRoleName.trim().length<2} className="rounded-xl border px-4 py-2 font-medium disabled:opacity-50">{customPending?"Generating…":"Generate role"}</button></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label><span className="text-sm font-medium">Career objective</span><input value={careerObjective} onChange={e=>setCareerObjective(e.target.value)} placeholder="Become placement-ready for backend roles" className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
            <label><span className="text-sm font-medium">Target date</span><input type="date" value={targetDate} onChange={e=>setTargetDate(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
            <label><span className="text-sm font-medium">Current experience</span><select value={experienceLevel} onChange={e=>setExperienceLevel(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2"><option value="BEGINNER">Beginner</option><option value="SOME_EXPERIENCE">Some experience</option><option value="INTERMEDIATE">Intermediate</option><option value="ADVANCED">Advanced</option></select></label>
            <label className="sm:col-span-2"><span className="text-sm font-medium">Goal context</span><textarea value={goalDescription} onChange={e=>setGoalDescription(e.target.value)} rows={3} placeholder="What do you want to be able to do, and why?" className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
          </div>
          <button type="button" disabled={pending||!roleVersionId} onClick={saveGoal} className="rounded-xl bg-brand-600 px-5 py-2.5 font-medium text-white disabled:opacity-50">{pending?"Saving…":"Continue to profile"}</button>
        </div>
      ):null}

      {step===2?(
        <div className="mt-8 space-y-6">
          <div><h2 className="text-xl font-semibold">Add profile evidence</h2><p className="mt-1 text-sm text-slate-600">Resume and project text are untrusted evidence sources. They never write capability directly.</p></div>
          <label className="block rounded-2xl border border-dashed bg-white p-5"><span className="text-sm font-medium">Resume PDF</span><input type="file" accept="application/pdf,.pdf" onChange={e=>setResume(e.target.files?.[0] ?? null)} className="mt-3 block w-full" /></label>
          <div className="rounded-2xl border bg-white p-5">
            <p className="font-medium">Optional project evidence</p>
            <input value={projectTitle} onChange={e=>setProjectTitle(e.target.value)} placeholder="Project title" className="mt-3 w-full rounded-xl border px-3 py-2" />
            <textarea value={projectDescription} onChange={e=>setProjectDescription(e.target.value)} rows={4} placeholder="What did you build and how did you use the technologies?" className="mt-3 w-full rounded-xl border px-3 py-2" />
            <input value={projectTechnologies} onChange={e=>setProjectTechnologies(e.target.value)} placeholder="React, Node.js, SQL..." className="mt-3 w-full rounded-xl border px-3 py-2" />
          </div>
          <div className="flex gap-3"><button type="button" onClick={()=>setStep(1)} className="rounded-xl border px-4 py-2">Back</button><button type="button" disabled={pending} onClick={uploadProfile} className="rounded-xl bg-brand-600 px-5 py-2.5 font-medium text-white disabled:opacity-50">{pending?"Uploading…":"Continue to preferences"}</button></div>
        </div>
      ):null}

      {step===3?(
        <div className="mt-8 space-y-6">
          <h2 className="text-xl font-semibold">Learning constraints</h2>
          <div className="grid gap-4 sm:grid-cols-2"><label><span className="text-sm font-medium">Hours/week</span><input type="number" min={1} max={80} value={hours} onChange={e=>setHours(Number(e.target.value))} className="mt-1 w-full rounded-xl border px-3 py-2" /></label><label><span className="text-sm font-medium">Session length</span><input type="number" min={15} max={240} value={session} onChange={e=>setSession(Number(e.target.value))} className="mt-1 w-full rounded-xl border px-3 py-2" /></label></div>
          <div><p className="text-sm font-medium">Learning days</p><div className="mt-2 flex flex-wrap gap-2">{DAYS.map(day=><button type="button" key={day} onClick={()=>toggleDay(day)} className={days.includes(day)?"rounded-lg bg-brand-600 px-3 py-2 text-sm text-white":"rounded-lg border px-3 py-2 text-sm"}>{day}</button>)}</div></div>
          <div><p className="text-sm font-medium">Preferred formats</p><div className="mt-2 flex flex-wrap gap-2">{["projects","practice","documentation","video","articles"].map(format=><button type="button" key={format} onClick={()=>toggleFormat(format)} className={formats.includes(format)?"rounded-lg bg-brand-600 px-3 py-2 text-sm text-white":"rounded-lg border px-3 py-2 text-sm"}>{format}</button>)}</div></div>
          <div><p className="text-sm font-medium">Roadmap adaptation</p><div className="mt-2 grid gap-3 sm:grid-cols-2">{["AUTOMATIC","ASK_FIRST"].map(mode=><button type="button" key={mode} onClick={()=>setAdaptation(mode)} className={adaptation===mode?"rounded-xl border-2 border-brand-500 bg-indigo-50 p-4 text-left":"rounded-xl border p-4 text-left"}><strong>{mode==="AUTOMATIC"?"Automatic":"Ask before applying"}</strong></button>)}</div></div>
          <div className="flex gap-3"><button type="button" onClick={()=>setStep(2)} className="rounded-xl border px-4 py-2">Back</button><button type="button" disabled={pending} onClick={savePreferences} className="rounded-xl bg-brand-600 px-5 py-2.5 font-medium text-white disabled:opacity-50">Analyze my profile</button></div>
        </div>
      ):null}

      {step===4?(
        <div className="mt-8 rounded-2xl border bg-white p-6">
          <h2 className="text-xl font-semibold">Building your SkillTwin</h2>
          <p className="mt-1 text-sm text-slate-600">{role?.name ? "Target: "+role.name : "Analyzing canonical learner state"}</p>
          <div className="mt-5 space-y-3">{analysisStage.map((stage,index)=><div key={index} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">✓</span><span className="text-sm">{stage}</span></div>)}</div>
          {pending?<p className="mt-5 text-sm text-slate-500">Analysis is still running…</p>:null}
          {!pending && analysisStage.includes("Onboarding complete")?<button type="button" onClick={()=>{router.push("/overview");router.refresh();}} className="mt-6 rounded-xl bg-brand-600 px-5 py-2.5 font-medium text-white">Open my SkillTwin</button>:null}
        </div>
      ):null}
    </section>
  );
}
