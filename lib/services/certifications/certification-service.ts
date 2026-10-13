import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rankCertifications, type LearnerGapSignal, type LearnerSkillSignal } from "@/lib/domain/certification-recommender";

type Named={name?:string};
type RoleRecord={target_roles?:Named|Named[]|null};
type SkillRecord={slug?:string};
function one<T>(value:T|T[]|null|undefined):T|null {
  return Array.isArray(value)?(value[0]??null):(value??null);
}
const numeric=(n:unknown):number|null=>{
  const v=Number(n);
  return n==null||!Number.isFinite(v)?null:v;
};
/** Server-side owner-scoped reads; no user IDs or rankings supplied by the browser. */
export async function getCertificationRecommendations(supabase:SupabaseClient,userId:string){
  const [{data:goal,error:goalError},{data:skills,error:skillsError}]=await Promise.all([
    supabase.from("career_goals")
      .select("id,role_versions!inner(target_roles!inner(name))")
      .eq("user_id",userId).eq("status","ACTIVE").limit(1).maybeSingle(),
    supabase.from("user_skills")
      .select("skill_id,level_value,confidence,evidence_count,skills!inner(slug)")
      .eq("user_id",userId)
  ]);
  if(goalError)throw goalError;
  if(skillsError)throw skillsError;
  const version=one(goal?.role_versions as RoleRecord|RoleRecord[]|null);
  const roleName=one(version?.target_roles)?.name??null;
  let snapshotId:string|null=null;
  let gapRows:Record<string,unknown>[]=[];
  if(goal){
    const {data:snapshot,error:snapshotError}=await supabase.from("gap_snapshots")
      .select("id").eq("goal_id",goal.id).eq("user_id",userId)
      .order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(snapshotError)throw snapshotError;
    snapshotId=snapshot?.id??null;
    if(snapshotId){
      const {data:gaps,error:gapsError}=await supabase.from("skill_gap_results")
        .select("skill_id,status,priority_band,gap_severity,skills!inner(slug)")
        .eq("snapshot_id",snapshotId).eq("user_id",userId)
        .order("priority_score",{ascending:false}).limit(100);
      if(gapsError)throw gapsError;
      gapRows=(gaps??[]) as Record<string,unknown>[];
    }
  }
  const learnerSkills:LearnerSkillSignal[]=(skills??[]).flatMap(row=>{
    const skill=one(row.skills as SkillRecord|SkillRecord[]|null);
    return skill?.slug?[{
      slug:skill.slug,level:row.level_value??null,
      confidence:numeric(row.confidence),evidenceCount:Number(row.evidence_count??0)
    }]:[];
  });
  const learnerGaps:LearnerGapSignal[]=gapRows.flatMap(row=>{
    const skill=one(row.skills as SkillRecord|SkillRecord[]|null);
    return skill?.slug?[{
      slug:skill.slug,status:row.status==null?null:String(row.status),
      priorityBand:row.priority_band==null?null:String(row.priority_band),
      severity:numeric(row.gap_severity)
    }]:[];
  });
  return {
    goalName:roleName,
    hasGapSnapshot:Boolean(snapshotId),
    matches:rankCertifications({goalName:roleName,skills:learnerSkills,gaps:learnerGaps})
  };
}
