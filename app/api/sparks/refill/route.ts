import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { claimWeeklySparks } from "@/lib/services/sparks/sparks-consumption";
import { getSparksWallet } from "@/lib/services/sparks/sparks-service";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(){
  const requestId=await getRequestId();
  try{
    const {user}=await requireUser();
    const granted=await claimWeeklySparks(user.id);
    return ok(requestId,{granted,wallet:await getSparksWallet(user.id)});
  }catch(error){
    if(error instanceof UnauthenticatedError)return fail(requestId,401,"UNAUTHENTICATED","Sign in to claim your weekly Sparks.");
    console.error("sparks.weekly.failed",{requestId,error:error instanceof Error?error.message:"unknown"});
    return fail(requestId,500,"SPARKS_WEEKLY_FAILED","Could not claim weekly Sparks. Try again.");
  }
}
