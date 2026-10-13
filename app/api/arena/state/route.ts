import {getRequestId} from "@/lib/api/request-context";
import {ok,fail} from "@/lib/api/responses";
import {requireUser,UnauthenticatedError} from "@/lib/auth/require-user";
import {arenaApiError,parseArenaState} from "@/lib/domain/arena";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(){
  const requestId=await getRequestId();
  try{
    const {supabase}=await requireUser();
    const {data,error}=await supabase.rpc("arena_get_state");
    if(error)throw error;
    const response=ok(requestId,{arena:parseArenaState(data)});
    response.headers.set("Cache-Control","private, no-store");
    return response;
  }catch(error){
    if(error instanceof UnauthenticatedError)
      return fail(requestId,401,"UNAUTHENTICATED","Sign in to view Arena.");
    const safe=arenaApiError(error);
    console.error("arena.state.failed",{requestId,errorType:error instanceof Error?error.name:"DatabaseError"});
    return fail(requestId,safe.status,safe.code,safe.message);
  }
}
