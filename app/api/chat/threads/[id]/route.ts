import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getJourneyChatService } from "@/lib/services/chat/journey-chat-service";

export const dynamic="force-dynamic";

export async function GET(_request:Request,context:{params:Promise<{id:string}>}){
  const requestId=await getRequestId();
  try{
    const {id}=await context.params;
    const {user}=await requireUser();
    return ok(requestId,await getJourneyChatService().getThread(user.id,id));
  }catch(error){
    if(error instanceof UnauthenticatedError) return fail(requestId,401,"UNAUTHENTICATED","Sign in to view this Journey Chat thread.");
    const message=error instanceof Error?error.message:String(error);
    if(message==="CHAT_THREAD_NOT_FOUND") return fail(requestId,404,"NOT_FOUND","Chat thread not found.");
    return fail(requestId,500,"CHAT_THREAD_FAILED","Could not load Journey Chat thread.");
  }
}
