import { z } from "zod";
import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getProjectEvidenceService } from "@/lib/services/profile/project-evidence-service";

const schema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(20).max(8000),
  technologies: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  artifactUrl: z.string().url().max(1000).nullable().optional()
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = await getRequestId();

  try {
    const { user } = await requireUser();
    const parsed = schema.safeParse(await request.json());

    if (!parsed.success) {
      return fail(
        requestId,
        400,
        "VALIDATION_ERROR",
        "Invalid project evidence.",
        parsed.error.flatten().fieldErrors
      );
    }

    const result = await getProjectEvidenceService().createAndAnalyze({
      userId: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      technologies: parsed.data.technologies,
      artifactUrl: parsed.data.artifactUrl ?? null
    });

    return ok(
      requestId,
      result,
      {
        skill_delta: result.evidence.deltas,
        notifications: [{
          title: "Project evidence processed",
          message: result.evidence.deltas.length
            ? "SkillTwin changed from new project evidence and role gaps were refreshed."
            : "Project evidence was stored without overstating capability.",
          tone: "success"
        }],
        next_action: {
          type: "OPEN_SKILLS",
          label: "Review SkillTwin",
          href: "/skills"
        }
      },
      201
    );
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return fail(requestId, 401, "UNAUTHENTICATED", "Sign in to add project evidence.");
    }

    console.error("project.evidence.failed", {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });
    return fail(requestId, 500, "PROJECT_EVIDENCE_FAILED", "Could not process this project.");
  }
}

export async function GET() {
  const requestId = await getRequestId();

  try {
    const { user, supabase } = await requireUser();
    const { data, error } = await supabase
      .from("profile_projects")
      .select("id,title,description,technologies,artifact_url,version,status,analysis_status,analysis_result,created_at,updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return ok(requestId, { projects: data ?? [] });
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return fail(requestId, 401, "UNAUTHENTICATED", "Sign in to view project evidence.");
    }

    console.error("project.list.failed", {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });
    return fail(requestId, 500, "PROJECT_LIST_FAILED", "Could not load your projects.");
  }
}
