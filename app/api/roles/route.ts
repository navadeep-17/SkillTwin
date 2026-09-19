import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getRoleService } from "@/lib/services/roles/role-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = await getRequestId();
  try {
    const {user}=await requireUser();
    return ok(requestId,{roles:await getRoleService().list(user.id)});
  } catch (error) {
    if (error instanceof UnauthenticatedError) return fail(requestId,401,"UNAUTHENTICATED","Sign in to view target roles.");
    return fail(requestId,500,"ROLE_LIST_FAILED","Could not load target roles.");
  }
}
