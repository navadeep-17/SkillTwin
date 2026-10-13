import {z} from "zod";
import {getRequestId} from "@/lib/api/request-context";
import {ok,fail} from "@/lib/api/responses";
import {requireUser,UnauthenticatedError} from "@/lib/auth/require-user";
import {arenaApiError} from "@/lib/domain/arena";

const answerSchema=z.object({
  matchId:z.string().uuid(),
  questionNumber:z.number().int().min(1).max(5),
  optionIndex:z.number().int().min(0).max(3)
}).strict();
export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function POST(request:Request){
  const requestId=await getRequestId();
  try{
    const {supabase}=await requireUser();
    let body:unknown;
    try{body=await request.json()}catch{
      return fail(requestId,400,"ARENA_INVALID_INPUT","Submit a valid quiz answer.");
    }
    const parsed=answerSchema.safeParse(body);
    if(!parsed.success)
      return fail(requestId,400,"ARENA_INVALID_INPUT","Choose one answer for the active question.");
    const {data,error}=await supabase.rpc("arena_submit_answer",{
      p_match_id:parsed.data.matchId,
      p_question_no:parsed.data.questionNumber,
      p_option_index:parsed.data.optionIndex
    });
    if(error)throw error;
    const response=ok(requestId,{
      accepted:data?.accepted===true,
      questionNumber:parsed.data.questionNumber
    });
    response.headers.set("Cache-Control","no-store");
    return response;
  }catch(error){
    if(error instanceof UnauthenticatedError)
      return fail(requestId,401,"UNAUTHENTICATED","Sign in to answer Arena questions.");
    const safe=arenaApiError(error);
    console.error("arena.answer.failed",{requestId,errorType:error instanceof Error?error.name:"DatabaseError"});
    return fail(requestId,safe.status,safe.code,safe.message);
  }
}
