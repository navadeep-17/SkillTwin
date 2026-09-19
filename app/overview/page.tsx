import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type AnyRow=Record<string,unknown>;

function localDate(value:string|Date,timeZone:string){
  return new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(value));
}
function startOfWeek(date:Date,timeZone:string){
  const local=localDate(date,timeZone);
  const [year,month,day]=local.split("-").map(Number);
  const pivot=new Date(Date.UTC(year,month-1,day));
  const weekday=pivot.getUTCDay() || 7;
  pivot.setUTCDate(pivot.getUTCDate()-(weekday-1));
  return pivot.toISOString().slice(0,10);
}
function addDays(date:string,days:number){
  const [y,m,d]=date.split("-").map(Number);
  const value=new Date(Date.UTC(y,m-1,d)); value.setUTCDate(value.getUTCDate()+days);
  return value.toISOString().slice(0,10);
}
function computeStreak(dates:string[],timeZone:string){
  const unique=[...new Set(dates.map(value=>localDate(value,timeZone)))].sort().reverse();
  if(!unique.length) return 0;
  const today=localDate(new Date(),timeZone);
  const yesterday=addDays(today,-1);
  if(unique[0]!==today && unique[0]!==yesterday) return 0;
  let cursor=unique[0],streak=0;
  for(const day of unique){
    if(day!==cursor) continue;
    streak+=1; cursor=addDays(cursor,-1);
  }
  return streak;
}
function roleName(goal:AnyRow|null){
  if(!goal) return "Target role";
  const version=goal.role_versions as AnyRow|null;
  const role=version?.target_roles as AnyRow|null;
  return String(role?.name ?? "Target role");
}

export default async function OverviewPage(){
  const supabase=await createClient();
  const {data:auth}=await supabase.auth.getUser();
  if(!auth.user) redirect("/login");

  const [
    {data:userRow,error:userError},
    {data:goal,error:goalError},
    {data:skills,error:skillsError},
    {data:snapshot,error:snapshotError},
    {data:activity,error:activityError},
    {data:plan,error:planError},
    {data:assessmentActivity,error:assessmentError},
    {data:taskActivity,error:taskActivityError}
  ]=await Promise.all([
    supabase.from("users").select("timezone,display_name,onboarding_completed_at").eq("id",auth.user.id).single(),
    supabase.from("career_goals").select("id,role_version_id,target_date,hours_per_week,career_objective,role_versions!inner(target_roles!inner(name,family))").eq("user_id",auth.user.id).eq("status","ACTIVE").limit(1).maybeSingle(),
    supabase.from("user_skills").select("skill_id,level_value,capability_score,confidence,conflict_state,evidence_count,last_validated_at,skills!inner(slug,canonical_name,category)").eq("user_id",auth.user.id).order("confidence",{ascending:false}),
    supabase.from("gap_snapshots").select("id,readiness,evidence_coverage,created_at").eq("user_id",auth.user.id).order("created_at",{ascending:false}).limit(1).maybeSingle(),
    supabase.from("agent_events").select("id,event_type,summary,created_at").eq("user_id",auth.user.id).order("created_at",{ascending:false}).limit(5),
    supabase.from("learning_plans").select("id,version,status,start_date,end_date,planned_minutes,adaptation_buffer_minutes").eq("user_id",auth.user.id).eq("status","ACTIVE").order("version",{ascending:false}).limit(1).maybeSingle(),
    supabase.from("skill_assessment_outcomes").select("created_at").eq("user_id",auth.user.id).order("created_at",{ascending:false}).limit(60),
    supabase.from("task_activity_events").select("created_at,event_type").eq("user_id",auth.user.id).eq("event_type","COMPLETED").order("created_at",{ascending:false}).limit(60)
  ]);
  for(const error of [userError,goalError,skillsError,snapshotError,activityError,planError,assessmentError,taskActivityError]) if(error) throw error;

  if(!goal){
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">SkillTwin</p>
        <h1 className="mt-2 text-3xl font-semibold">Choose a target before SkillTwin plans</h1>
        <p className="mt-3 max-w-2xl text-slate-600">Onboarding sets the target role, profile evidence, learning constraints, and adaptation preference before creating Plan v1.</p>
        <Link href="/onboarding" className="mt-6 inline-flex rounded-xl bg-brand-600 px-5 py-2.5 font-medium text-white">Start onboarding</Link>
      </main>
    );
  }

  let gaps:AnyRow[]=[];
  if(snapshot?.id){
    const {data,error}=await supabase.from("skill_gap_results")
      .select("id,skill_id,current_score,current_confidence,target_score,gap_severity,priority_score,priority_band,status,recommended_action,reason_codes,skills!inner(slug,canonical_name,category)")
      .eq("snapshot_id",snapshot.id).order("priority_score",{ascending:false}).limit(8);
    if(error) throw error; gaps=(data ?? []) as AnyRow[];
  }

  let tasks:AnyRow[]=[];
  if(plan?.id){
    const {data,error}=await supabase.from("learning_tasks")
      .select("id,title,type,duration_minutes,due_at,status,difficulty,completed_at,skill_id,skills!inner(canonical_name)")
      .eq("plan_id",plan.id).order("due_at",{ascending:true});
    if(error) throw error; tasks=(data ?? []) as AnyRow[];
  }

  const zone=String(userRow?.timezone ?? "Asia/Kolkata");
  const today=localDate(new Date(),zone);
  const weekStart=startOfWeek(new Date(),zone),weekEnd=addDays(weekStart,6);
  const dueThisWeek=tasks.filter(task=>{
    if(!task.due_at) return false;
    const date=localDate(String(task.due_at),zone);
    return date>=weekStart && date<=weekEnd;
  });
  const completedThisWeek=tasks.filter(task=>{
    if(!task.completed_at) return false;
    const date=localDate(String(task.completed_at),zone);
    return date>=weekStart && date<=weekEnd;
  });
  const upcoming=tasks.filter(task=>["PLANNED","IN_PROGRESS"].includes(String(task.status)));
  const todayTasks=upcoming.filter(task=>task.due_at && localDate(String(task.due_at),zone)===today);
  const todaysPlan=(todayTasks.length?todayTasks:upcoming).slice(0,4);
  const completedTasks=tasks.filter(task=>task.status==="COMPLETED").length;
  const roadmapProgress=tasks.length?Math.round(100*completedTasks/tasks.length):0;
  const validated=(skills ?? []).filter(skill=>Boolean(skill.last_validated_at)).length;
  const streak=computeStreak([
    ...(assessmentActivity ?? []).map(row=>row.created_at),
    ...(taskActivity ?? []).map(row=>row.created_at)
  ],zone);
  const challenge=gaps.find(gap=>["VALIDATE","VALIDATE_FIRST"].includes(String(gap.recommended_action)))
    ?? gaps.find(gap=>Number(gap.current_confidence ?? 0)<0.55)
    ?? gaps[0] ?? null;
  const role=roleName(goal);
  const topGaps=gaps.filter(gap=>gap.status!=="STRONG").slice(0,4);

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">{role} · Live SkillTwin</p>
          <h1 className="mt-2 text-3xl font-semibold">Your current learning state</h1>
          <p className="mt-2 text-slate-600">SkillTwin separates observed capability, confidence, target-role gaps, and learning activity.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/practice" className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white">Challenge Me</Link>
          <Link href="/onboarding" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium">Add evidence</Link>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Career readiness" value={snapshot?String(snapshot.readiness)+"%":"—"} detail={"Guidance for "+role+", not hiring probability"} />
        <Metric label="Weekly progress" value={completedThisWeek.length+"/"+Math.max(dueThisWeek.length,completedThisWeek.length)} detail="Tasks completed / planned this week" />
        <Metric label="Validated skills" value={String(validated)} detail={(skills?.length ?? 0)+" skills currently tracked"} />
        <Metric label="Learning streak" value={streak+" day"+(streak===1?"":"s")} detail="Completed learning/validation days" />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Today&apos;s Plan</p><h2 className="mt-1 text-xl font-semibold">{todayTasks.length?"Due today":"Next up"}</h2></div>{plan?<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">Plan v{plan.version}</span>:null}</div>
          <div className="mt-5 space-y-3">
            {todaysPlan.length?todaysPlan.map(task=><Link key={String(task.id)} href={"/roadmap/task/"+String(task.id)} className="block rounded-xl border border-slate-200 p-4 hover:border-brand-300">
              <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{String(task.type)}</p><p className="mt-1 font-medium">{String(task.title)}</p></div><span className="text-xs text-slate-500">{String(task.duration_minutes)} min</span></div>
              <p className="mt-2 text-xs text-slate-400">{task.due_at?"Due "+new Date(String(task.due_at)).toLocaleString():"Flexible timing"}</p>
            </Link>):<p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">{plan?"No upcoming tasks remain in the active roadmap.":"Complete onboarding to create Plan v1."}</p>}
          </div>
          {plan?<div className="mt-5"><div className="flex items-center justify-between text-sm"><span className="font-medium">Current roadmap progress</span><span>{roadmapProgress}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-600" style={{width:roadmapProgress+"%"}} /></div><Link href="/roadmap" className="mt-3 inline-flex text-sm font-medium text-brand-700">Open full roadmap →</Link></div>:null}
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Agent insight</p>
            <h2 className="mt-1 text-xl font-semibold">{challenge?"Validate "+String((challenge.skills as AnyRow|null)?.canonical_name ?? "an uncertain skill"):"Keep building evidence"}</h2>
            <p className="mt-2 text-sm leading-6 text-indigo-950">{challenge
              ? "This skill is currently "+String(challenge.priority_band).toLowerCase()+" priority with "+Math.round(Number(challenge.current_confidence ?? 0)*100)+"% confidence. Challenge Me can reduce uncertainty before SkillTwin commits a roadmap change."
              : "No high-priority validation candidate is available in the latest role snapshot."}</p>
            <Link href="/practice" className="mt-4 inline-flex rounded-xl bg-indigo-700 px-4 py-2 text-sm font-medium text-white">Challenge Me</Link>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">SkillTwin summary</p>
            <h2 className="mt-1 text-xl font-semibold">Where to focus</h2>
            <div className="mt-4 space-y-3">{topGaps.length?topGaps.map(gap=>{
              const skill=gap.skills as AnyRow|null;
              return <div key={String(gap.id)} className="rounded-xl bg-slate-50 p-3"><div className="flex justify-between gap-3"><p className="font-medium">{String(skill?.canonical_name ?? "Skill")}</p><span className="text-xs font-semibold">{String(gap.priority_band)}</span></div><p className="mt-1 text-xs text-slate-500">{String(gap.recommended_action)} · gap {Math.round(Number(gap.gap_severity)*100)}%</p></div>;
            }):<p className="text-sm text-slate-500">No active gap rows yet.</p>}</div>
            <Link href="/skills" className="mt-4 inline-flex text-sm font-medium text-brand-700">Explore Skill Graph →</Link>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Recent Agent Activity</p><h2 className="mt-1 text-xl font-semibold">Why your state changed</h2></div><Link href="/activity" className="text-sm font-medium text-brand-700">Full audit trail →</Link></div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">{activity?.length?activity.map(event=><div key={event.id} className="rounded-xl border-l-2 border-indigo-300 bg-slate-50 p-4"><p className="text-sm font-medium">{event.summary}</p><p className="mt-1 text-xs text-slate-400">{new Date(event.created_at).toLocaleString()}</p></div>):<p className="text-sm text-slate-500">No committed agent events yet.</p>}</div>
      </section>
    </main>
  );
}

function Metric({label,value,detail}:{label:string;value:string;detail:string}){
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p><p className="mt-2 text-sm text-slate-500">{detail}</p></div>;
}
