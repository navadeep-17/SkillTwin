import {z} from "zod";
import {getRequestId} from "@/lib/api/request-context";
import {fail,ok} from "@/lib/api/responses";
import {requireUser,UnauthenticatedError} from "@/lib/auth/require-user";
import {
  CertificationJourneyError,planJourneyUpdate,
  type CertificationJourney
} from "@/lib/domain/certification-journey";

const uuid=z.string().uuid();
const version=z.number().int().min(1).max(2147483646);
const actionSchema=z.discriminatedUnion("action",[
  z.object({action:z.literal("START_PREPARATION"),expectedVersion:version}).strict(),
  z.object({action:z.literal("TOGGLE_TOPIC"),expectedVersion:version,
    topic:z.string().min(1).max(160)}).strict(),
  z.object({action:z.literal("SET_EXAM_TARGET"),expectedVersion:version,
    targetExamDate:z.string().max(10)}).strict(),
  z.object({action:z.literal("REPORT_EARNED"),expectedVersion:version,
    earnedDate:z.string().max(10),credentialUrl:z.string().max(1000).nullable().optional()}).strict()
]);
const deleteSchema=z.object({expectedVersion:version}).strict();
const fields="id,certification_id,status,completed_topics,target_exam_date,earned_date,credential_url,version,updated_at";
export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function PATCH(request:Request,context:{params:Promise<{id:string}>}){
  const requestId=await getRequestId();
  try {
    const {user,supabase}=await requireUser();
    const {id}=await context.params;
    if(!uuid.safeParse(id).success)
      return fail(requestId,400,"INVALID_GOAL_ID","Invalid certification goal.");
    const payload=actionSchema.safeParse(await request.json());
    if(!payload.success)
      return fail(requestId,400,"INVALID_ACTION","Invalid certification journey update.");
    const {data:row,error:readError}=await supabase.from("user_certification_goals")
      .select(fields).eq("user_id",user.id).eq("id",id).limit(1).maybeSingle();
    if(readError)throw readError;
    if(!row)return fail(requestId,404,"CERTIFICATION_GOAL_NOT_FOUND","Certification goal not found.");
    if(row.version!==payload.data.expectedVersion)
      return fail(requestId,409,"STALE_CERTIFICATION_GOAL","This certification was updated elsewhere. Refresh to continue.");
    const today=new Date().toISOString().slice(0,10);
    let patch;
    try{
      patch=planJourneyUpdate(row as CertificationJourney,payload.data,today);
    }catch(error){
      if(error instanceof CertificationJourneyError)
        return fail(requestId,422,error.code,"This update is not valid for the current certification stage.");
      throw error;
    }
    // Single conditional update: concurrent writes with the same version do
    // not silently overwrite one another.
    const {data:updated,error:updateError}=await supabase.from("user_certification_goals")
      .update({...patch,version:row.version+1})
      .eq("id",id).eq("user_id",user.id).eq("version",payload.data.expectedVersion)
      .select(fields).maybeSingle();
    if(updateError)throw updateError;
    if(!updated)return fail(requestId,409,"STALE_CERTIFICATION_GOAL",
      "Your certification journey changed. Reload and try again.");
    return ok(requestId,{goal:updated});
  }catch(error){
    if(error instanceof UnauthenticatedError)
      return fail(requestId,401,"UNAUTHENTICATED","Sign in to update your certification journey.");
    console.error("certification.journey.update.failed",{requestId,errorType:error instanceof Error?error.name:"DatabaseWriteError"});
    return fail(requestId,500,"CERTIFICATION_UPDATE_FAILED","Could not update this certification journey.");
  }
}

export async function DELETE(request:Request,context:{params:Promise<{id:string}>}){
  const requestId=await getRequestId();
  try {
    const {user,supabase}=await requireUser();
    const {id}=await context.params;
    if(!uuid.safeParse(id).success)
      return fail(requestId,400,"INVALID_GOAL_ID","Invalid certification goal.");
    const payload=deleteSchema.safeParse(await request.json());
    if(!payload.success)
      return fail(requestId,400,"INVALID_ACTION","Expected certification version is required.");
    const {data,error}=await supabase.from("user_certification_goals")
      .delete().eq("id",id).eq("user_id",user.id).eq("version",payload.data.expectedVersion)
      .select("id").maybeSingle();
    if(error)throw error;
    if(!data)return fail(requestId,409,"STALE_CERTIFICATION_GOAL",
      "The certification was already removed or updated. Refresh your journey.");
    return ok(requestId,{removedId:id});
  }catch(error){
    if(error instanceof UnauthenticatedError)
      return fail(requestId,401,"UNAUTHENTICATED","Sign in to remove this certification.");
    console.error("certification.journey.delete.failed",{requestId,errorType:error instanceof Error?error.name:"DatabaseWriteError"});
    return fail(requestId,500,"CERTIFICATION_DELETE_FAILED","Could not remove this certification.");
  }
}
