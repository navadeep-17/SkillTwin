import { getRequestId } from "@/lib/api/request-context";
import {fail,ok} from "@/lib/api/responses";
import {requireUser,UnauthenticatedError} from "@/lib/auth/require-user";
import {getCertificationRecommendations} from "@/lib/services/certifications/certification-service";

export const runtime="nodejs";
export const dynamic="force-dynamic";

/** Read-only recommendations; ranking inputs always come from the signed-in account. */
export async function GET(){
  const requestId=await getRequestId();
  try {
    const {user,supabase}=await requireUser();
    const data=await getCertificationRecommendations(supabase,user.id);
    return ok(requestId,data);
  } catch(error){
    if(error instanceof UnauthenticatedError)
      return fail(requestId,401,"UNAUTHENTICATED","Sign in to view personalized certifications.");
    console.error("certifications.read.failed",{
      requestId,errorType:error instanceof Error?error.name:"DatabaseReadError"
    });
    return fail(requestId,500,"CERTIFICATIONS_UNAVAILABLE",
      "Could not retrieve certification recommendations.");
  }
}
