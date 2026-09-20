import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getWeeklyReportService } from "@/lib/services/progress/weekly-report-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = await getRequestId();

  try {
    const { user } = await requireUser();
    const report = await getWeeklyReportService().latest(user.id);
    return ok(requestId, { report });
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return fail(requestId, 401, "UNAUTHENTICATED", "Sign in to view your weekly report.");
    }

    console.error("progress.weekly_report.read.failed", {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });
    return fail(requestId, 500, "WEEKLY_REPORT_READ_FAILED", "Could not load the weekly report.");
  }
}

export async function POST() {
  const requestId = await getRequestId();

  try {
    const { user } = await requireUser();
    const report = await getWeeklyReportService().generate(user.id);
    return ok(requestId, { report }, {
      notifications: [{
        title: "Weekly report ready",
        message: "SkillTwin summarized validated progress separately from learning activity.",
        tone: "success"
      }]
    });
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return fail(requestId, 401, "UNAUTHENTICATED", "Sign in to generate your weekly report.");
    }

    console.error("progress.weekly_report.generate.failed", {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });
    return fail(requestId, 500, "WEEKLY_REPORT_GENERATE_FAILED", "Could not generate the weekly report.");
  }
}
