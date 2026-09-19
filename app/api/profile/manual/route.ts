import { z } from "zod";
import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getManualProfileService } from "@/lib/services/profile/manual-profile-service";

const postSchema=z.object({
  title:z.string().trim().min(2).max(120).default("Manual profile"),
  text:z.string().trim().min(20).max(12000)
});
const patchSchema=postSchema.partial().extend({id:z.string().uuid()}).refine(value=>value.title!==undefined || value.text!==undefined,{message:"Provide a change."});

export const runtime="nodejs";
export const maxDuration=60;
export const dynamic="force-dynamic";

export async function GET(){
  const requestId=await getRequestId();
  try{
    const {user}=await requireUser();
    return ok(requestId,{sources:await getManualProfileService().list(user.id)});
  }catch(error){
    if(error instanceof UnauthenticatedError) return fail(requestId,401,"UNAUTHENTICATED","Sign in to view manual profile sources.");
    return fail(requestId,500,"MANUAL_PROFILE_READ_FAILED","Could not load manual profile sources.");
  }
}

export async function POST(request:Request){
  const requestId=await getRequestId();
  try{
    const {user}=await requireUser();
    const parsed=postSchema.safeParse(await request.json());
    if(!parsed.success) return fail(requestId,400,"VALIDATION_ERROR","Invalid manual profile.",parsed.error.flatten().fieldErrors);
    const result=await getManualProfileService().createAndAnalyze({userId:user.id,title:parsed.data.title,text:parsed.data.text});
    return ok(requestId,result,{
      skill_delta:result.result.evidence?.deltas ?? [],
      notifications:[{title:"Manual profile analyzed",message:"SkillTwin added conservative source-backed profile evidence.",tone:"success"}]
    },201);
  }catch(error){
    if(error instanceof UnauthenticatedError) return fail(requestId,401,"UNAUTHENTICATED","Sign in to analyze manual profile context.");
    console.error("manual.profile.failed",{requestId,error:error instanceof Error?error.message:String(error)});
    return fail(requestId,500,"MANUAL_PROFILE_FAILED","Could not analyze manual profile context.");
  }
}

export async function PATCH(request:Request){
  const requestId=await getRequestId();
  try{
    const {user}=await requireUser();
    const parsed=patchSchema.safeParse(await request.json());
    if(!parsed.success) return fail(requestId,400,"VALIDATION_ERROR","Invalid manual profile update.",parsed.error.flatten().fieldErrors);
    const result=await getManualProfileService().updateAndAnalyze({
      userId:user.id,sourceId:parsed.data.id,title:parsed.data.title,text:parsed.data.text
    });
    return ok(requestId,result,{
      skill_delta:result.result.evidence?.deltas ?? [],
      notifications:[{title:"Manual profile re-analyzed",message:"Old evidence was superseded and the canonical SkillTwin was recomputed.",tone:"success"}]
    });
  }catch(error){
    if(error instanceof UnauthenticatedError) return fail(requestId,401,"UNAUTHENTICATED","Sign in to update manual profile context.");
    const message=error instanceof Error?error.message:String(error);
    if(message==="MANUAL_SOURCE_NOT_FOUND") return fail(requestId,404,"NOT_FOUND","Manual profile source not found.");
    return fail(requestId,500,"MANUAL_PROFILE_UPDATE_FAILED","Could not update manual profile context.");
  }
}
