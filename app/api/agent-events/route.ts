import { z } from "zod";
import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";

const querySchema=z.object({
  limit:z.coerce.number().int().min(1).max(100).default(30),
  cursor:z.string().datetime().optional()
});

export const dynamic="force-dynamic";

export async function GET(request:Request){
  const requestId=await getRequestId();
  try{
    const {user,supabase}=await requireUser();
    const parsed=querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    if(!parsed.success) return fail(requestId,400,"VALIDATION_ERROR","Invalid activity query.");
    let query=supabase.from("agent_events")
      .select("id,event_type,trigger_type,trigger_ref,summary,entity_refs,evidence_refs,metadata,created_at")
      .eq("user_id",user.id)
      .order("created_at",{ascending:false})
      .order("id",{ascending:false})
      .limit(parsed.data.limit+1);
    if(parsed.data.cursor) query=query.lt("created_at",parsed.data.cursor);
    const {data,error}=await query;
    if(error) throw error;
    const hasMore=(data?.length ?? 0)>parsed.data.limit;
    const events=(data ?? []).slice(0,parsed.data.limit);
    return ok(requestId,{events,nextCursor:hasMore?events.at(-1)?.created_at ?? null:null});
  }catch(error){
    if(error instanceof UnauthenticatedError) return fail(requestId,401,"UNAUTHENTICATED","Sign in to view Agent Activity.");
    console.error("agent.events.failed",{requestId,error:error instanceof Error?error.message:String(error)});
    return fail(requestId,500,"AGENT_ACTIVITY_FAILED","Could not load Agent Activity.");
  }
}
