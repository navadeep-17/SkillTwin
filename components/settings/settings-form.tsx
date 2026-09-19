"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type Goal = Record<string,unknown> | null;
type Settings = Record<string,unknown> | null;

const DAYS=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

export function SettingsForm({goal,settings}:{goal:Goal;settings:Settings}) {
  const [careerObjective,setCareerObjective]=useState(String(goal?.career_objective ?? ""));
  const [targetDate,setTargetDate]=useState(String(goal?.target_date ?? ""));
  const [hours,setHours]=useState(Number(goal?.hours_per_week ?? 10));
  const [session,setSession]=useState(Number(goal?.preferred_session_minutes ?? 60));
  const [days,setDays]=useState<string[]>(Array.isArray(goal?.learning_days) ? goal!.learning_days as string[] : ["Mon","Tue","Wed","Thu","Fri","Sat"]);
  const [adaptation,setAdaptation]=useState(String(goal?.adaptation_mode ?? "AUTOMATIC"));
  const [formats,setFormats]=useState<string[]>(Array.isArray(goal?.preferred_formats) ? goal!.preferred_formats as string[] : ["projects","practice","documentation"]);
  const [weekly,setWeekly]=useState(Boolean(settings?.weekly_report_enabled ?? true));
  const [notifications,setNotifications]=useState(Boolean(settings?.notifications_enabled ?? true));
  const [reducedMotion,setReducedMotion]=useState(Boolean(settings?.reduced_motion ?? false));
  const [message,setMessage]=useState("");
  const [pending,setPending]=useState(false);

  async function submit(event:FormEvent) {
    event.preventDefault();
    setPending(true); setMessage("");
    try {
      if (goal?.id) {
        const response=await fetch("/api/goals/"+String(goal.id),{
          method:"PATCH",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({careerObjective:careerObjective||null,targetDate:targetDate||null,hoursPerWeek:hours,preferredSessionMinutes:session,learningDays:days,preferredFormats:formats,adaptationMode:adaptation})
        });
        const payload=await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "Goal settings failed.");
      }
      const settingsResponse=await fetch("/api/settings",{
        method:"PATCH",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({weeklyReportEnabled:weekly,notificationsEnabled:notifications,reducedMotion})
      });
      const settingsPayload=await settingsResponse.json();
      if (!settingsResponse.ok || !settingsPayload.ok) throw new Error(settingsPayload.error?.message ?? "Settings failed.");
      setMessage("Settings saved. Role-gap priorities were refreshed without changing capability evidence.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save settings.");
    } finally { setPending(false); }
  }

  function toggleDay(day:string) {
    setDays(current=>current.includes(day) ? (current.length>1 ? current.filter(x=>x!==day) : current) : [...current,day]);
  }
  function toggleFormat(format:string) {
    setFormats(current=>current.includes(format) ? (current.length>1 ? current.filter(x=>x!==format) : current) : [...current,format]);
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><h2 className="text-xl font-semibold">Goal and timeline</h2><p className="mt-1 text-sm text-slate-500">Timeline changes recompute role-gap urgency. Changing the target role uses the explicit onboarding workflow.</p></div>
          <Link href="/onboarding" className="rounded-xl border px-4 py-2 text-sm font-medium">Change target role</Link>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label><span className="text-sm font-medium">Career objective</span><input value={careerObjective} onChange={e=>setCareerObjective(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" placeholder="Placement-ready for my target role" /></label>
          <label><span className="text-sm font-medium">Target date</span><input type="date" value={targetDate} onChange={e=>setTargetDate(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold">Learning schedule</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label><span className="text-sm font-medium">Hours/week</span><input type="number" min={1} max={80} value={hours} onChange={e=>setHours(Number(e.target.value))} className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
          <label><span className="text-sm font-medium">Preferred session minutes</span><input type="number" min={15} max={240} value={session} onChange={e=>setSession(Number(e.target.value))} className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
        </div>
        <p className="mt-4 text-sm font-medium">Learning days</p>
        <div className="mt-2 flex flex-wrap gap-2">{DAYS.map(day=><button key={day} type="button" onClick={()=>toggleDay(day)} className={days.includes(day)?"rounded-lg bg-brand-600 px-3 py-2 text-sm text-white":"rounded-lg border px-3 py-2 text-sm"}>{day}</button>)}</div>
        <p className="mt-4 text-sm font-medium">Preferred formats</p>
        <div className="mt-2 flex flex-wrap gap-2">{["projects","practice","documentation","video","articles"].map(format=><button key={format} type="button" onClick={()=>toggleFormat(format)} className={formats.includes(format)?"rounded-lg bg-brand-600 px-3 py-2 text-sm text-white":"rounded-lg border px-3 py-2 text-sm"}>{format}</button>)}</div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold">Adaptation</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {["AUTOMATIC","ASK_FIRST"].map(mode=><button key={mode} type="button" onClick={()=>setAdaptation(mode)} className={adaptation===mode?"rounded-xl border-2 border-brand-500 bg-indigo-50 p-4 text-left":"rounded-xl border p-4 text-left"}><strong>{mode==="AUTOMATIC"?"Automatic":"Ask before changes"}</strong><p className="mt-1 text-sm text-slate-600">{mode==="AUTOMATIC"?"Apply validated minor future-plan patches automatically.":"Create a PlanDiff proposal and wait for your confirmation."}</p></button>)}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold">Experience</h2>
        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-3"><input type="checkbox" checked={weekly} onChange={e=>setWeekly(e.target.checked)} /> Weekly report</label>
          <label className="flex items-center gap-3"><input type="checkbox" checked={notifications} onChange={e=>setNotifications(e.target.checked)} /> In-app notifications</label>
          <label className="flex items-center gap-3"><input type="checkbox" checked={reducedMotion} onChange={e=>setReducedMotion(e.target.checked)} /> Reduced motion</label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold">Profile data</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link href="/onboarding" className="rounded-xl border px-4 py-2 text-sm font-medium">Resume / manual profile / certificates</Link>
          <Link href="/projects" className="rounded-xl border px-4 py-2 text-sm font-medium">Add/update project evidence</Link>
        </div>
      </section>

      {message?<p className="rounded-xl bg-slate-100 p-3 text-sm">{message}</p>:null}
      <button disabled={pending} className="rounded-xl bg-brand-600 px-5 py-2.5 font-medium text-white disabled:opacity-50">{pending?"Saving…":"Save settings"}</button>
    </form>
  );
}
