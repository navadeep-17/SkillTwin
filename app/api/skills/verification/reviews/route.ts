import { z } from "zod";
import { getRequestId } from "@/lib/api/request-context";
import { fail,ok } from "@/lib/api/responses";
import { requireUser,UnauthenticatedError } from "@/lib/auth/require-user";
import { PracticalReviewError,submitPracticalReview } from "@/lib/services/skills/practical-review-a3-service";

export const dynamic="force-dynamic";
export const runtime="nodejs";
const schema=z.object({
  learnerUserId:z.string().uuid(),
  projectId:z.string().uuid(),
  criterionId:z.string().max(100).regex(/^[a-z0-9-]+\.[a-z0-9-]+$/),
  commitSha:z.string().regex(/^[a-f0-9]{40}$/),
  verdict:z.enum(["PASS","FAIL"]),
  practicalTask:z.string().trim().min(50).max(2000),
  observedResult:z.string().trim().min(50).max(2000),
  testProcedure:z.string().trim().min(30).max(2000),
  observedLearnerLive:z.literal(true)
}).strict();

/** A3 reviewer-only, human attestation endpoint. No raw code evaluation. */
export async function POST(request:Request){
  const requestId=await getRequestId();
  if(process.env.SKILLTWIN_EVIDENCE_A3_ENABLED!=="true")
    return fail(requestId,404,"NOT_FOUND","Practical review pilot unavailable.");
  try{
    const {user}=await requireUser();
    const payload=schema.safeParse(await request.json());
    if(!payload.success)
      return fail(requestId,400,"INVALID_REVIEW","Provide a pinned commit and an independently observed practical task outcome.");
    const result=await submitPracticalReview(payload.data,user.id);
    return ok(requestId,{review:result},undefined,201);
  }catch(error){
    if(error instanceof UnauthenticatedError)
      return fail(requestId,401,"UNAUTHENTICATED","Sign in to submit a review.");
    if(error instanceof PracticalReviewError){
      const status=error.code==="REVIEWER_NOT_AUTHORIZED"?403
        :["ALREADY_REVIEWED","REPOSITORY_CHANGED_RESTART","PROJECT_CHANGED_RESTART"].includes(error.code)?409
        :["PROJECT_NOT_ELIGIBLE","INVALID_REVIEW","CRITERION_NOT_REVIEWED","RUBRIC_SKILL_NOT_FOUND"].includes(error.code)?422
        :404;
      return fail(requestId,status,error.code,"The independent practical review could not be accepted.");
    }
    const message=error instanceof Error?error.message:"UNKNOWN";
    if(message==="INSUFFICIENT_CODE_FILES"||message==="PUBLIC_REPOSITORY_NOT_FOUND")
      return fail(requestId,422,"REPOSITORY_NOT_INSPECTABLE","This public repository cannot be safely inspected.");
    console.error("evidence.a3.review.failed",{requestId,error:message});
    return fail(requestId,500,"PRACTICAL_REVIEW_FAILED","Review submission failed without changing skill scores.");
  }
}
