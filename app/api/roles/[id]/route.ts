import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getRoleService } from "@/lib/services/roles/role-service";

export const dynamic = "force-dynamic";

export async function GET(_request:Request,context:{params:Promise<{id:string}>}) {
  const requestId = await getRequestId();
  try {
    const {user}=await requireUser();
    const {id}=await context.params;
    return ok(requestId,{role:await getRoleService().get(user.id,id)});
  } catch (error) {
    if (error instanceof UnauthenticatedError) return fail(requestId,401,"UNAUTHENTICATED","Sign in to view this role.");
    const message=error instanceof Error ? error.message : String(error);
    if (message==="ROLE_NOT_FOUND") return fail(requestId,404,"NOT_FOUND","Target role not found.");
    return fail(requestId,500,"ROLE_READ_FAILED","Could not load target role.");
  }
}
