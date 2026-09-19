import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";

export const dynamic="force-dynamic";

export async function GET() {
  const requestId=await getRequestId();
  try {
    const {user,supabase}=await requireUser();
    const {data:snapshot,error:snapshotError}=await supabase.from("gap_snapshots").select("id").eq("user_id",user.id).order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(snapshotError) throw snapshotError;
    if(!snapshot) return ok(requestId,{recommended:null,skills:[]});
    const {data:gaps,error}=await supabase.from("skill_gap_results")
      .select("skill_id,current_confidence,priority_score,priority_band,recommended_action,reason_codes,skills!inner(slug,canonical_name,category),user_skills(confidence,last_validated_at)")
      .eq("snapshot_id",snapshot.id)
      .order("priority_score",{ascending:false});
    if(error) throw error;
    const assessable=[];
    for(const gap of gaps ?? []){
      const {count}=await supabase.from("assessment_question_bank").select("id",{count:"exact",head:true}).eq("skill_id",gap.skill_id).eq("is_active",true);
      if((count ?? 0)<4) continue;
      const state=Array.isArray(gap.user_skills)?gap.user_skills[0]:gap.user_skills;
      const confidence=Number(state?.confidence ?? gap.current_confidence ?? 0);
      assessable.push({...gap,validationValue:Number((Number(gap.priority_score)*(1.25-confidence)).toFixed(4)),lastValidatedAt:state?.last_validated_at ?? null});
    }
    assessable.sort((a,b)=>b.validationValue-a.validationValue);
    const recommended=assessable[0] ?? null;
    return ok(requestId,{recommended,skills:assessable.slice(0,12)});
  } catch(error){
    if(error instanceof UnauthenticatedError) return fail(requestId,401,"UNAUTHENTICATED","Sign in to view practice recommendations.");
    return fail(requestId,500,"PRACTICE_RECOMMENDATIONS_FAILED","Could not load validation recommendations.");
  }
}
