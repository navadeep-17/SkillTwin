import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getWeeklyReportService } from "@/lib/services/progress/weekly-report-service";

export const dynamic="force-dynamic";

export async function GET() {
  const requestId=await getRequestId();
  try {
    const {user}=await requireUser();
    return ok(requestId,{report:await getWeeklyReportService().getOrGenerate(user.id)});
  } catch(error){
    if(error instanceof UnauthenticatedError) return fail(requestId,401,"UNAUTHENTICATED","Sign in to view the weekly report.");
    return fail(requestId,500,"WEEKLY_REPORT_FAILED","Could not build the weekly report.");
  }
}
