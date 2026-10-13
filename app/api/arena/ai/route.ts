import {getRequestId} from "@/lib/api/request-context";
import {ok,fail} from "@/lib/api/responses";
import {requireUser,UnauthenticatedError} from "@/lib/auth/require-user";
import {arenaApiError} from "@/lib/domain/arena";
import {startAiAfterWait} from "@/lib/services/arena/arena-ai-service";

export const runtime="nodejs";
export const dynamic="force-dynamic";

/** A signed-in, server-timed human queue may transition to AI after 20 seconds.
 * No client-provided clock, answers, learner ID, or session ID is trusted.
 */
export async function POST(){
  const requestId=await getRequestId();
  try{
    const {user}=await requireUser();
    const arena=await startAiAfterWait(user.id);
    const response=ok(requestId,{arena});
    response.headers.set("Cache-Control","private, no-store");
    return response;
  }catch(error){
    if(error instanceof UnauthenticatedError)
      return fail(requestId,401,"UNAUTHENTICATED","Sign in for Arena practice.");
    console.error("arena.ai.start.failed",{
      requestId,errorType:error instanceof Error?error.name:"AIStartError"
    });
    const safe=arenaApiError(error);
    return fail(requestId,safe.status,safe.code,safe.message);
  }
}
