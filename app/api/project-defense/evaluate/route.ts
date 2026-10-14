import {z} from "zod";
import {getRequestId} from "@/lib/api/request-context";
import {fail,ok} from "@/lib/api/responses";
import {requireUser,UnauthenticatedError} from "@/lib/auth/require-user";
import { spendSparks, refundSparks, InsufficientSparksError, DuplicateSparksOperationError } from "@/lib/services/sparks/sparks-service";
import {evaluatePublicRepositoryDefense} from "@/lib/services/projects/project-defense-service";

const schema=z.object({
  repoUrl:z.string().max(250),
  commitSha:z.string().regex(/^[a-f0-9]{40}$/i),
  answers:z.array(z.object({
    questionId:z.string().max(40),
    answer:z.string().trim().min(40).max(4000)
  })).length(3)
});
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:Request){
  const requestId=await getRequestId();
  try{
    const {user}=await requireUser();
    const input=schema.safeParse(await request.json());
    if(!input.success)return fail(requestId,400,"INVALID_INPUT","Answer all three code-grounded questions (at least 40 characters each).");
    const operationKey = "project-defense:" + input.data.commitSha + ":" +
      (await import("node:crypto")).createHash("sha256").update(JSON.stringify(input.data.answers)).digest("hex").slice(0,24);
    try { await spendSparks(user.id,"PROJECT_DEFENSE",operationKey); }
    catch(error) {
      if(error instanceof InsufficientSparksError) return fail(requestId,402,"INSUFFICIENT_SPARKS","Not enough Sparks for Project Defense. Invite a friend from /sparks.");
      if(error instanceof DuplicateSparksOperationError) return fail(requestId,409,"SPARKS_OPERATION_ALREADY_USED","This project defense submission was already attempted.");
      throw error;
    }
    try {
      const result=await evaluatePublicRepositoryDefense(input.data);
      return ok(requestId,result);
    } catch(error) {
      await refundSparks(user.id,"PROJECT_DEFENSE",operationKey);
      throw error;
    }
  }catch(error){
    if(error instanceof UnauthenticatedError)return fail(requestId,401,"UNAUTHENTICATED","Sign in to defend a project.");
    const code=error instanceof Error?error.message:"PROJECT_DEFENSE_UNAVAILABLE";
    if(["INVALID_COMMIT_SHA","INVALID_DEFENSE_ANSWERS","INVALID_PUBLIC_REPOSITORY_URL"].includes(code))
      return fail(requestId,400,code,"Invalid or incomplete project defense request.");
    if(code==="REPOSITORY_CHANGED_RESTART")
      return fail(requestId,409,code,"The repository changed since inspection. Reinspect the repository and start again.");
    if(code==="GITHUB_RATE_LIMIT")return fail(requestId,429,code,"Public GitHub request limit reached. Retry later.");
    console.error("project.defense.evaluate.failed",{requestId,code});
    return fail(requestId,502,"PROJECT_DEFENSE_EVALUATION_FAILED",
      "Evaluation could not be verified against the public source. No score or evidence was updated.");
  }
}
