import { z } from "zod";
import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getManualProfileService } from "@/lib/services/profile/manual-profile-service";

const schema = z.object({
  title: z.string().trim().min(2).max(120),
  text: z.string().trim().min(40).max(12000)
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = await getRequestId();

  try {
    const { user } = await requireUser();
    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return fail(requestId, 400, "VALIDATION_ERROR", "Add a short title and enough profile detail to analyze.", parsed.error.flatten().fieldErrors);
    }

    const result = await getManualProfileService().createAndAnalyze({
      userId: user.id,
      title: parsed.data.title,
      text: parsed.data.text
    });

    return ok(requestId, result, {
      skill_delta: result.evidence.deltas,
      notifications: [{
        title: "Profile evidence processed",
        message: result.evidence.deltas.length
          ? "SkillTwin changed from your manual profile evidence."
          : "Profile evidence was stored without overstating capability.",
        tone: "success"
      }],
      next_action: { type: "OPEN_SKILLS", label: "Review SkillTwin", href: "/skills" }
    }, 201);
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return fail(requestId, 401, "UNAUTHENTICATED", "Sign in to add profile evidence.");
    }

    console.error("profile.manual.failed", {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });
    return fail(requestId, 500, "MANUAL_PROFILE_FAILED", "Could not process manual profile evidence.");
  }
}
