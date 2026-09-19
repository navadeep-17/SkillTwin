import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TaskExecutionPanel } from "@/components/roadmap/task-execution-panel";
import { ResourceFeedbackButtons } from "@/components/roadmap/resource-feedback-buttons";

export default async function LearningTaskPage({params}:{params:Promise<{id:string}>}) {
  const supabase=await createClient();
  const {data:auth}=await supabase.auth.getUser();
  if(!auth.user) redirect("/login");
  const {id}=await params;

  const {data:task,error}=await supabase.from("learning_tasks")
    .select("*,learning_plans!inner(user_id,version,status),learning_objectives!inner(success_criteria,target_score,start_score,type),skills!inner(canonical_name,category)")
    .eq("id",id).eq("learning_plans.user_id",auth.user.id).maybeSingle();
  if(error) throw error;
  if(!task) notFound();

  const [{data:assignment,error:assignmentError},{data:gap,error:gapError}] = await Promise.all([
    supabase.from("task_resource_assignments").select("resource_id,explanation,learning_resources!inner(title,provider,url,format,duration_minutes,quality)").eq("task_id",id).limit(1).maybeSingle(),
    supabase.from("skill_gap_results").select("target_score,current_score,current_confidence,reason_codes").eq("skill_id",task.skill_id).order("created_at",{ascending:false}).limit(1).maybeSingle()
  ]);
  if(assignmentError) throw assignmentError;
  if(gapError) throw gapError;

  const skill=task.skills as {canonical_name?:string;category?:string}|null;
  const objective=task.learning_objectives as {success_criteria?:string;target_score?:number;start_score?:number|null;type?:string}|null;
  const resource=assignment?.learning_resources as {title?:string;provider?:string;url?:string;format?:string;duration_minutes?:number|null}|null;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/roadmap" className="text-sm font-medium text-brand-700">← Roadmap</Link>
      <div className="mt-5 flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{task.type} · {skill?.category ?? ""}</p><h1 className="mt-1 text-3xl font-semibold">{task.title}</h1></div><span className="rounded-full bg-slate-100 px-3 py-1 text-sm">{task.duration_minutes} min</span></div>

      <section className="mt-7 rounded-2xl border bg-white p-6"><h2 className="font-semibold">Learning objective</h2><p className="mt-2 leading-7 text-slate-600">{objective?.success_criteria ?? "Complete the task and validate the targeted skill."}</p></section>

      <section className="mt-5 rounded-2xl border bg-white p-6"><h2 className="font-semibold">Why are you learning this?</h2><p className="mt-2 text-sm leading-6 text-slate-600">Target score: {Number(gap?.target_score ?? objective?.target_score ?? 0).toFixed(1)}/4. Current validated score: {gap?.current_score==null?"unknown":Number(gap.current_score).toFixed(1)+"/4"}. Confidence: {Math.round(Number(gap?.current_confidence ?? 0)*100)}%.</p>{Array.isArray(gap?.reason_codes)?<p className="mt-2 text-xs text-slate-400">Reason codes: {gap.reason_codes.join(" · ")}</p>:null}</section>

      {resource?.url?(
        <section className="mt-5 rounded-2xl border bg-white p-6"><h2 className="font-semibold">Verified resource</h2><p className="mt-2 font-medium">{resource.title}</p><p className="text-sm text-slate-500">{resource.provider} · {resource.format}{resource.duration_minutes?" · "+resource.duration_minutes+" min":""}</p><p className="mt-3 text-sm text-slate-600">{assignment?.explanation}</p><a href={resource.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white">Open resource</a>
        {assignment?.resource_id?<ResourceFeedbackButtons resourceId={String(assignment.resource_id)} taskId={task.id} />:null}
        </section>
      ):null}

      {(task.type==="PRACTICE"||task.type==="BUILD")?<section className="mt-5 rounded-2xl border bg-white p-6"><h2 className="font-semibold">Success criteria</h2><p className="mt-2 text-sm leading-6 text-slate-600">{objective?.success_criteria}</p><Link href="/journey" className="mt-4 inline-flex text-sm font-medium text-brand-700">Ask SkillTwin for a hint →</Link></section>:null}

      <div className="mt-6"><TaskExecutionPanel task={{id:task.id,type:task.type,status:task.status,dueAt:task.due_at,actualMinutes:task.actual_minutes}} /></div>
    </main>
  );
}
