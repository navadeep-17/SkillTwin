import {z} from "zod";
import {getRequestId} from "@/lib/api/request-context";
import {fail,ok} from "@/lib/api/responses";
import {requireUser,UnauthenticatedError} from "@/lib/auth/require-user";
import {certificationById} from "@/lib/domain/certification-catalog";

const saveSchema=z.object({certificationId:z.string().min(2).max(100)}).strict();
const fields="id,certification_id,status,completed_topics,target_exam_date,earned_date,credential_url,version,created_at,updated_at";
export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(){
  const requestId=await getRequestId();
  try{
    const {user,supabase}=await requireUser();
    const {data,error}=await supabase.from("user_certification_goals")
      .select(fields).eq("user_id",user.id).order("updated_at",{ascending:false}).limit(80);
    if(error)throw error;
    return ok(requestId,{journey:data??[]});
  }catch(error){
    if(error instanceof UnauthenticatedError)
      return fail(requestId,401,"UNAUTHENTICATED","Sign in to see your certification journey.");
    console.error("certification.journey.read.failed",{requestId,errorType:error instanceof Error?error.name:"DatabaseReadError"});
    return fail(requestId,500,"CERTIFICATION_JOURNEY_UNAVAILABLE","Could not load your certification journey.");
  }
}

export async function POST(request:Request){
  const requestId=await getRequestId();
  try{
    const {user,supabase}=await requireUser();
    const payload=saveSchema.safeParse(await request.json());
    if(!payload.success||!certificationById(payload.data.certificationId))
      return fail(requestId,400,"INVALID_CERTIFICATION","Choose a credential from the reviewed catalog.");
    const certificationId=payload.data.certificationId;
    // One goal per learner and credential, protected by a unique DB constraint.
    const {data:existing,error:lookupError}=await supabase.from("user_certification_goals")
      .select(fields).eq("user_id",user.id).eq("certification_id",certificationId)
      .limit(1).maybeSingle();
    if(lookupError)throw lookupError;
    if(existing)return ok(requestId,{goal:existing,created:false});

    const {data,error}=await supabase.from("user_certification_goals")
      .insert({user_id:user.id,certification_id:certificationId})
      .select(fields).single();
    if(error){
      if(error.code==="23505"){
        const {data:concurrent,error:lookupError}=await supabase.from("user_certification_goals")
          .select(fields).eq("user_id",user.id).eq("certification_id",certificationId)
          .limit(1).single();
        if(lookupError)throw lookupError;
        return ok(requestId,{goal:concurrent,created:false});
      }
      throw error;
    }
    return ok(requestId,{goal:data,created:true});
  }catch(error){
    if(error instanceof UnauthenticatedError)
      return fail(requestId,401,"UNAUTHENTICATED","Sign in to save a certification.");
    console.error("certification.journey.create.failed",{requestId,errorType:error instanceof Error?error.name:"DatabaseWriteError"});
    return fail(requestId,500,"CERTIFICATION_SAVE_FAILED","Could not save the certification goal.");
  }
}
