import { randomUUID } from "node:crypto";
import { getRequestId } from "@/lib/api/request-context";
import { getSql } from "@/lib/db/postgres";
import { reserveSparksUsage,finishSparksUsage,SparksActionInProgressError } from "@/lib/services/sparks/sparks-consumption";
import { InsufficientSparksError,DuplicateSparksOperationError } from "@/lib/services/sparks/sparks-service";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getProfileAnalysisService } from "@/lib/services/profile/profile-analysis-service";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ documentId: string }> }
) {
  const requestId = await getRequestId();
  let reserved: {userId:string;key:string}|null=null;

  try {
    const { documentId } = await context.params;
    const { user, supabase } = await requireUser();
    // Cached completed analyses are free; only processing a new resume
    // consumes a quota slot or Sparks. Reference is server-checked for ownership.
    const sql=getSql();
    const owned=await sql.unsafe(
      "select 1 from public.profile_documents where id=$1::uuid and user_id=$2::uuid and document_type='resume' limit 1",
      [documentId,user.id]
    );
    if(!owned.length)return fail(requestId,404,"NOT_FOUND","Resume document not found.");
    const cached=await sql.unsafe(
      "select 1 from public.profile_analysis_runs where source_id=$1::uuid and user_id=$2::uuid and status='complete' and evidence_batch_result is not null limit 1",
      [documentId,user.id]
    );
    if(!cached.length){
      const key="resume:"+documentId+":"+randomUUID();
      try{
        const claim=await reserveSparksUsage({userId:user.id,action:"RESUME_REANALYSIS",key,referenceId:documentId});
        if(claim.enabled)reserved={userId:user.id,key};
      }catch(error){
        if(error instanceof InsufficientSparksError)return fail(requestId,402,"INSUFFICIENT_SPARKS","Not enough Sparks for another resume analysis. See /sparks for earning options.");
        if(error instanceof SparksActionInProgressError||error instanceof DuplicateSparksOperationError)
          return fail(requestId,409,"SPARKS_ACTION_IN_PROGRESS","This resume is being analyzed already. Check its status before retrying.");
        throw error;
      }
    }
    const analysis = await getProfileAnalysisService().analyzeResume({
      userId: user.id,documentId,supabase
    });
    if(reserved){
      await finishSparksUsage(user.id,reserved.key,true);
      reserved=null;
    }

    const result = analysis.result as {
      evidence?: { deltas?: unknown[] };
      gapAnalysis?: { readiness?: number } | null;
    };

    return ok(
      requestId,
      analysis,
      {
        skill_delta: result.evidence?.deltas ?? [],
        notifications: [{
          title: analysis.reused ? "Profile analysis already complete" : "Profile analysis complete",
          message: result.gapAnalysis?.readiness != null
            ? "SkillTwin updated. Career readiness is now " + result.gapAnalysis.readiness + "%."
            : "Profile evidence processed.",
          tone: "success"
        }],
        next_action: {
          type: "OPEN_OVERVIEW",
          label: "View your SkillTwin",
          href: "/overview"
        }
      }
    );
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return fail(requestId, 401, "UNAUTHENTICATED", "Sign in to analyze your resume.");
    }

    if(reserved){
      try{await finishSparksUsage(reserved.userId,reserved.key,false);}
      catch(refundError){console.error("sparks.resume.refund.failed",{requestId,error:refundError instanceof Error?refundError.message:"unknown"});}
    }
    const message = error instanceof Error ? error.message : String(error);
    if (message === "PROFILE_DOCUMENT_NOT_FOUND") {
      return fail(requestId, 404, "NOT_FOUND", "Resume document not found.");
    }
    if (message === "ACTIVE_GOAL_NOT_FOUND") {
      return fail(requestId, 409, "ACTIVE_GOAL_NOT_FOUND", "Choose and save a target role before analyzing your resume.");
    }
    if (message === "TEXT_EXTRACTION_TOO_LOW") {
      return fail(
        requestId,
        422,
        "PDF_TEXT_TOO_LOW",
        "This PDF appears image-based or has too little extractable text. Upload a text-based PDF for now."
      );
    }

    console.error("profile.analysis.failed", { requestId, error: message });
    return fail(requestId, 500, "PROFILE_ANALYSIS_FAILED", "Could not analyze this resume.");
  }
}
