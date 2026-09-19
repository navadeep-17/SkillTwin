import { z } from "zod";
import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getProjectRecommendationService } from "@/lib/services/projects/project-recommendation-service";

const patchSchema=z.object({status:z.enum(["STARTED","COMPLETED","DISMISSED"])});

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function POST() {
  const requestId=await getRequestId();
  try {
    const {user}=await requireUser();
    const result=await getProjectRecommendationService().generate(user.id);
    return ok(requestId,result,{
      notifications:[{title:result.reused?"Project recommendation already current":"Gap-targeted project ready",message:"The brief targets the latest role gaps but does not create skill evidence until you actually submit/evaluate project work.",tone:"success"}]
    },result.reused?200:201);
  } catch(error){
    if(error instanceof UnauthenticatedError) return fail(requestId,401,"UNAUTHENTICATED","Sign in to generate a project recommendation.");
    const message=error instanceof Error?error.message:String(error);
    if(message==="ACTIVE_GOAL_NOT_FOUND"||message==="GAP_SNAPSHOT_NOT_FOUND") return fail(requestId,409,message,"Complete target-role analysis before requesting a project.");
    if(message==="NO_PROJECT_GAPS") return fail(requestId,409,"NO_PROJECT_GAPS","Current role snapshot has no active project-targetable gaps.");
    console.error("project.recommendation.failed",{requestId,error:message});
    return fail(requestId,500,"PROJECT_RECOMMENDATION_FAILED","Could not generate a project recommendation.");
  }
}

export async function GET() {
  const requestId=await getRequestId();
  try {
    const {user,supabase}=await requireUser();
    const {data,error}=await supabase.from("project_recommendations").select("*").eq("user_id",user.id).order("created_at",{ascending:false}).limit(10);
    if(error) throw error;
    return ok(requestId,{recommendations:data ?? [],current:(data ?? []).find(item=>["ACTIVE","STARTED"].includes(item.status)) ?? null});
  } catch(error){
    if(error instanceof UnauthenticatedError) return fail(requestId,401,"UNAUTHENTICATED","Sign in to view project recommendations.");
    return fail(requestId,500,"PROJECT_RECOMMENDATION_READ_FAILED","Could not load project recommendations.");
  }
}

export async function PATCH(request:Request) {
  const requestId=await getRequestId();
  try {
    const {user}=await requireUser();
    const url=new URL(request.url);
    const id=url.searchParams.get("id");
    if(!id) return fail(requestId,400,"VALIDATION_ERROR","Recommendation id is required.");
    const parsed=patchSchema.safeParse(await request.json());
    if(!parsed.success) return fail(requestId,400,"VALIDATION_ERROR","Invalid recommendation status.");
    return ok(requestId,{recommendation:await getProjectRecommendationService().updateStatus(user.id,id,parsed.data.status)});
  } catch(error){
    if(error instanceof UnauthenticatedError) return fail(requestId,401,"UNAUTHENTICATED","Sign in to update project recommendations.");
    return fail(requestId,500,"PROJECT_RECOMMENDATION_UPDATE_FAILED","Could not update project recommendation.");
  }
}
