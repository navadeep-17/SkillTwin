import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { activateSparksReferral, getSparksWallet } from "@/lib/services/sparks/sparks-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const requestId = await getRequestId();
  try {
    const { user } = await requireUser();
    await activateSparksReferral(user.id);
    return ok(requestId, await getSparksWallet(user.id));
  } catch (error) {
    if (error instanceof UnauthenticatedError) return fail(requestId,401,"UNAUTHENTICATED","Sign in to view Sparks.");
    console.error("sparks.wallet.failed", {requestId,error: error instanceof Error ? error.message : "unknown"});
    return fail(requestId,500,"SPARKS_UNAVAILABLE","Could not load your Sparks wallet.");
  }
}
