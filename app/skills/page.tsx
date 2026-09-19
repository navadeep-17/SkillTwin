import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SkillGraphExplorer, type SkillGraphItem } from "@/components/skills/skill-graph-explorer";

export default async function SkillsPage() {
  const supabase=await createClient();
  const {data:auth}=await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const [{data:goal,error:goalError},{data:userSkills,error:skillError},{data:evidence,error:evidenceError}] = await Promise.all([
    supabase.from("career_goals").select("id,role_version_id").eq("user_id",auth.user.id).eq("status","ACTIVE").limit(1).maybeSingle(),
    supabase.from("user_skills").select("skill_id,level_value,capability_score,confidence,conflict_state,evidence_count,source_family_count,last_validated_at,skills!inner(canonical_name,category,description)").eq("user_id",auth.user.id),
    supabase.from("skill_evidence").select("id,skill_id,source_type,claim,effective_weight,status").eq("user_id",auth.user.id).in("status",["ACCEPTED","NON_AGGREGATING"]).order("created_at",{ascending:false}).limit(180)
  ]);
  if (goalError) throw goalError;
  if (skillError) throw skillError;
  if (evidenceError) throw evidenceError;

  if (!goal) return <main className="mx-auto max-w-5xl px-6 py-10"><p>No active target role. Complete onboarding first.</p></main>;

  const [{data:snapshot,error:snapshotError},{data:requirements,error:reqError},{data:dependencies,error:depError}] = await Promise.all([
    supabase.from("gap_snapshots").select("id,readiness,evidence_coverage").eq("goal_id",goal.id).order("created_at",{ascending:false}).limit(1).maybeSingle(),
    supabase.from("role_skill_requirements").select("id,skill_id,target_score,importance_band,learning_stage,rationale,skills!inner(canonical_name,category),requirement_groups!inner(name,group_type)").eq("role_version_id",goal.role_version_id).order("learning_stage"),
    supabase.from("role_dependency_edges").select("prerequisite_requirement_id,dependent_requirement_id,edge_type").eq("role_version_id",goal.role_version_id)
  ]);
  if (snapshotError) throw snapshotError;
  if (reqError) throw reqError;
  if (depError) throw depError;

  let gaps:Array<Record<string,unknown>>=[];
  if(snapshot?.id){
    const {data,error}=await supabase.from("skill_gap_results").select("*").eq("snapshot_id",snapshot.id);
    if(error) throw error; gaps=data ?? [];
  }

  const skillMap=new Map((userSkills ?? []).map(item=>[item.skill_id,item]));
  const gapMap=new Map(gaps.map(item=>[String(item.requirement_id),item]));
  const evidenceMap=new Map<string,Array<{id:string;source_type:string;claim:string;effective_weight:number}>>();
  for(const item of evidence ?? []){
    const list=evidenceMap.get(item.skill_id) ?? [];
    list.push({id:item.id,source_type:item.source_type,claim:item.claim,effective_weight:Number(item.effective_weight)});
    evidenceMap.set(item.skill_id,list);
  }
  const reqById=new Map((requirements ?? []).map(req=>[req.id,req]));

  const items:SkillGraphItem[]=(requirements ?? []).map(req=>{
    const state=skillMap.get(req.skill_id);
    const gap=gapMap.get(req.id);
    const skill=req.skills as {canonical_name?:string;category?:string}|null;
    const prereqIds=(dependencies ?? []).filter(edge=>edge.dependent_requirement_id===req.id).map(edge=>edge.prerequisite_requirement_id);
    const prereqs=prereqIds.map(id=>{
      const source=reqById.get(id);
      const sourceState=source ? skillMap.get(source.skill_id) : null;
      const sourceSkill=source?.skills as {canonical_name?:string}|null;
      return {skillId:source?.skill_id ?? id,name:sourceSkill?.canonical_name ?? "Prerequisite",met:Boolean(sourceState?.capability_score!=null && Number(sourceState.capability_score)>=Number(source?.target_score ?? 0))};
    });
    return {
      requirementId:req.id,
      skillId:req.skill_id,
      name:skill?.canonical_name ?? "Skill",
      category:skill?.category ?? "",
      targetScore:Number(req.target_score),
      currentScore:state?.capability_score==null?null:Number(state.capability_score),
      level:String(state?.level_value ?? "UNKNOWN"),
      confidence:Number(state?.confidence ?? 0),
      status:String(gap?.status ?? "GAP") as SkillGraphItem["status"],
      priorityBand:String(gap?.priority_band ?? "LOW"),
      recommendedAction:String(gap?.recommended_action ?? "VALIDATE"),
      rationale:req.rationale,
      evidence:evidenceMap.get(req.skill_id) ?? [],
      prerequisites:prereqs
    };
  });

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <header><p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">Skill Graph</p><h1 className="mt-2 text-3xl font-semibold">What you know, what you need, and what comes first</h1><p className="mt-2 max-w-3xl text-slate-600">Graph and matrix use the same canonical role requirements. Capability and confidence remain separate.</p></header>

      <section className="mt-8"><SkillGraphExplorer items={items} dependencies={(dependencies ?? []).map(edge=>({from:edge.prerequisite_requirement_id,to:edge.dependent_requirement_id,type:edge.edge_type}))} /></section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Accessible alternative</p><h2 className="mt-1 text-xl font-semibold">Skill Matrix</h2></div><p className="text-sm text-slate-500">{snapshot?"Readiness "+snapshot.readiness+"% · coverage "+snapshot.evidence_coverage+"%":"No snapshot yet"}</p></div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b text-xs uppercase tracking-wide text-slate-500"><th className="py-3">Skill</th><th>Capability</th><th>Confidence</th><th>Target</th><th>Status</th><th>Priority</th><th>Action</th></tr></thead><tbody>{items.map(item=><tr key={item.requirementId} className="border-b last:border-0"><td className="py-4 font-medium">{item.name}<p className="text-xs font-normal text-slate-400">{item.category}</p></td><td>{item.level}{item.currentScore==null?"":" · "+item.currentScore.toFixed(2)}</td><td>{Math.round(item.confidence*100)}%</td><td>{item.targetScore.toFixed(1)}</td><td>{item.status}</td><td>{item.priorityBand}</td><td>{item.recommendedAction}</td></tr>)}</tbody></table>
        </div>
      </section>
    </main>
  );
}
