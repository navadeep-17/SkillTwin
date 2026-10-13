import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { DiscoverableRole } from "@/components/discovery/career-discovery";
import { OrbitExplore } from "./orbit-explore";
import { OrbitPreviewNav } from "@/components/orbit/orbit-preview-nav";
import "../orbit-lab/orbit-lab.css";
import "./orbit-explore.css";

export const dynamic="force-dynamic";
export const metadata={title:"Explore Career Paths — SkillTwin Orbit",description:"Compare real modeled career requirements without fabricating a fit score."};

type RoleMeta={name?:string;family?:string|null;owner_user_id?:string|null};
type SkillMeta={canonical_name?:string;category?:string|null};
type GroupMeta={name?:string;group_type?:string};
function one<T>(v:T|T[]|null|undefined):T|null{return Array.isArray(v)?(v[0]??null):v??null;}

export default async function OrbitExplorePage(){
  const supabase=await createClient();
  const {data:auth}=await supabase.auth.getUser();
  if(!auth.user)redirect("/login?next=%2Forbit-explore");

  const [versionsResult,skillsResult,goalResult]=await Promise.all([
    supabase.from("role_versions")
      .select("id,role_id,version,source,target_roles!inner(id,name,slug,family,owner_user_id)")
      .eq("status","ACTIVE").order("version",{ascending:false}),
    supabase.from("user_skills")
      .select("skill_id,level_value").eq("user_id",auth.user.id),
    supabase.from("career_goals")
      .select("role_version_id").eq("user_id",auth.user.id).eq("status","ACTIVE").limit(1).maybeSingle()
  ]);
  for(const result of [versionsResult,skillsResult,goalResult])if(result.error)throw result.error;
  const latest=new Map<string,NonNullable<typeof versionsResult.data>[number]>();
  for(const v of versionsResult.data??[])if(!latest.has(String(v.role_id)))latest.set(String(v.role_id),v);
  const current=[...latest.values()];
  const ids=current.map(v=>String(v.id));
  type Req={
    role_version_id:string;skill_id:string;group_id:string;
    requirement_groups:GroupMeta|GroupMeta[]|null;
    target_score:number;importance:number;importance_band:string;
    learning_stage:number;rationale:string;skills:SkillMeta|SkillMeta[]|null;
  };
  let requirements:Req[]=[];
  if(ids.length){
    const reqResult=await supabase.from("role_skill_requirements")
      .select("role_version_id,skill_id,group_id,target_score,importance,importance_band,learning_stage,rationale,skills!inner(canonical_name,category),requirement_groups!inner(name,group_type)")
      .in("role_version_id",ids).limit(2500);
    if(reqResult.error)throw reqResult.error;
    requirements=(reqResult.data??[]) as Req[];
  }
  // Recorded is not independently demonstrated: preserve the original
  // discovery model's distinction, rather than claiming a personal "match".
  const documented=new Set((skillsResult.data??[]).filter(s=>s.level_value!=="UNKNOWN").map(s=>String(s.skill_id)));
  const roles:DiscoverableRole[]=current.map(v=>{
    const meta=one(v.target_roles as RoleMeta|RoleMeta[]|null);
    const reqs=requirements.filter(r=>r.role_version_id===v.id)
      .sort((a,b)=>Number(b.importance)-Number(a.importance));
    const uniqueIds=new Set(reqs.map(r=>String(r.skill_id)));
    return {
      id:String(v.id),roleId:String(v.role_id),name:String(meta?.name??"Career role"),
      family:String(meta?.family??"Other careers"),version:Number(v.version),
      source:v.source==="AI_GENERATED"?"AI_GENERATED":"SEEDED",
      personal:Boolean(meta?.owner_user_id),requirementCount:uniqueIds.size,
      documentedCount:[...uniqueIds].filter(id=>documented.has(id)).length,
      requirements:reqs.map(r=>{
        const metaSkill=one(r.skills),group=one(r.requirement_groups);
        return {
          groupName:String(group?.name??"Competency"),
          groupType:(group?.group_type==="ANY_OF"?"ANY_OF":group?.group_type==="ALL_OF"?"ALL_OF":"SINGLE") as "ANY_OF"|"ALL_OF"|"SINGLE",
          skillId:String(r.skill_id),documented:documented.has(String(r.skill_id)),
          name:String(metaSkill?.canonical_name??"Competency"),
          category:String(metaSkill?.category??""),importance:String(r.importance_band),
          stage:Number(r.learning_stage),targetScore:Number(r.target_score),rationale:String(r.rationale)
        };
      })
    };
  }).sort((a,b)=>a.family.localeCompare(b.family)||a.name.localeCompare(b.name));
  return <main className="orbit-lab orbit-explore">
    <OrbitPreviewNav/>
    <OrbitExplore roles={roles} activeRoleVersionId={goalResult.data?.role_version_id??null}/>
  </main>;
}
