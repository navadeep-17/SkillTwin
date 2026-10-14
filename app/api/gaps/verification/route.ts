import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getEvidenceA3Preview } from "@/lib/services/gaps/evidence-verification-a3-service";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export async function GET(){
  const requestId=await getRequestId();
  // Disabled unless explicitly opted into a private, read-only A3 pilot.
  if(process.env.SKILLTWIN_EVIDENCE_A3_ENABLED!=="true")
    return fail(requestId,404,"NOT_FOUND","Verification preview is unavailable.");
  try{
    const {user}=await requireUser();
    const preview=await getEvidenceA3Preview(user.id);
    return ok(requestId,{preview});
  }catch(error){
    if(error instanceof UnauthenticatedError)
      return fail(requestId,401,"UNAUTHENTICATED","Sign in to view your verification preview.");
    console.error("evidence.a3.preview.failed",{
      requestId,error:error instanceof Error?error.message:String(error)
    });
    return fail(requestId,500,"EVIDENCE_PREVIEW_FAILED","Could not load the verification preview.");
  }
}
