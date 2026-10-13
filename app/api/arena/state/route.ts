import {getRequestId} from "@/lib/api/request-context";
import {ok,fail} from "@/lib/api/responses";
import {requireUser,UnauthenticatedError} from "@/lib/auth/require-user";
import {arenaApiError} from "@/lib/domain/arena";
import {getArenaState} from "@/lib/services/arena/arena-ai-service";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(){
  const requestId=await getRequestId();
  try{
    const {user}=await requireUser();
    const arena=await getArenaState(user.id);
    const response=ok(requestId,{arena});
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
