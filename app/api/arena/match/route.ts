import {z} from "zod";
import {getRequestId} from "@/lib/api/request-context";
import {ok,fail} from "@/lib/api/responses";
import {requireUser,UnauthenticatedError} from "@/lib/auth/require-user";
import {arenaApiError,arenaTopicSchema,parseArenaState} from "@/lib/domain/arena";

const requestSchema=z.discriminatedUnion("action",[
  z.object({action:z.literal("find"),topic:arenaTopicSchema}).strict(),
  z.object({action:z.literal("cancel")}).strict()
]);
export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function POST(request:Request){
  const requestId=await getRequestId();
  try{
    const {supabase}=await requireUser();
    let body:unknown;
    try{body=await request.json()}catch{
      return fail(requestId,400,"ARENA_INVALID_INPUT","Supply a valid Arena request.");
    }
    const parsed=requestSchema.safeParse(body);
    if(!parsed.success)
      return fail(requestId,400,"ARENA_INVALID_INPUT","Choose a topic or cancel the queue.");
    const action=parsed.data;
    const called=action.action==="find"
      ?await supabase.rpc("arena_find_match",{p_topic:action.topic})
      :await supabase.rpc("arena_cancel_wait");
    if(called.error)throw called.error;
    // The authenticated database function exclusively owns pairing state.
    const state=await supabase.rpc("arena_get_state");
    if(state.error)throw state.error;
    const response=ok(requestId,{arena:parseArenaState(state.data)});
    response.headers.set("Cache-Control","no-store");
    return response;
  }catch(error){
    if(error instanceof UnauthenticatedError)
      return fail(requestId,401,"UNAUTHENTICATED","Sign in to join Arena.");
    const safe=arenaApiError(error);
    console.error("arena.match.failed",{requestId,errorType:error instanceof Error?error.name:"DatabaseError"});
    return fail(requestId,safe.status,safe.code,safe.message);
  }
}
