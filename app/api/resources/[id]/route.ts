import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";

export const dynamic="force-dynamic";

export async function GET(_request:Request,context:{params:Promise<{id:string}>}) {
  const requestId=await getRequestId();
  try {
    const {id}=await context.params;
    const {supabase}=await requireUser();
    const {data,error}=await supabase.from("learning_resources")
      .select("id,title,provider,url,tags,levels,format,duration_minutes,quality,is_verified,status,catalog_version,last_verified_at")
      .eq("id",id).eq("is_verified",true).eq("status","ACTIVE").maybeSingle();
    if(error) throw error;
    if(!data) return fail(requestId,404,"NOT_FOUND","Verified resource not found.");
    return ok(requestId,{resource:data});
  } catch(error){
    if(error instanceof UnauthenticatedError) return fail(requestId,401,"UNAUTHENTICATED","Sign in to view this resource.");
    return fail(requestId,500,"RESOURCE_READ_FAILED","Could not load this resource.");
  }
}
