import { randomUUID } from "node:crypto";
import { z } from "zod";
import { classifyJourneyIntent } from "@/lib/domain/journey-intent";
import { isMutatingJourneyIntent } from "@/lib/domain/agent-read-plan";
import { enhancedReadIsMetered } from "@/lib/domain/sparks";
import { reserveSparksUsage,finishSparksUsage } from "@/lib/services/sparks/sparks-consumption";
import { InsufficientSparksError,DuplicateSparksOperationError } from "@/lib/services/sparks/sparks-service";
import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getJourneyChatService } from "@/lib/services/chat/journey-chat-service";

const postSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  threadId: z.string().uuid().nullable().optional(),
  enhanced: z.boolean().default(false),
  operationId: z.string().uuid().optional()
});

const getSchema = z.object({
  threadId: z.string().uuid().optional()
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = await getRequestId();
  let reserved: {userId:string;key:string}|null=null;

  try {
    const { user } = await requireUser();
    const parsed = postSchema.safeParse(await request.json());
    if (!parsed.success) {
      return fail(requestId, 400, "VALIDATION_ERROR", "Invalid chat message.", parsed.error.flatten().fieldErrors);
    }

    const premium=enhancedReadIsMetered(
      parsed.data.enhanced,isMutatingJourneyIntent(classifyJourneyIntent(parsed.data.message))
    );
    const key="enhanced-chat:"+(parsed.data.operationId??randomUUID());
    if(premium){
      try{
        const claim=await reserveSparksUsage({userId:user.id,action:"ENHANCED_CHAT",key});
        if(claim.enabled)reserved={userId:user.id,key};
      }catch(error){
        if(error instanceof InsufficientSparksError)return fail(requestId,402,"INSUFFICIENT_SPARKS","Not enough Sparks for Enhanced AI. Switch to free Standard mode or visit /sparks.");
        if(error instanceof DuplicateSparksOperationError)return fail(requestId,409,"SPARKS_OPERATION_ALREADY_USED","That Enhanced AI question was already submitted. Check chat history.");
        throw error;
      }
    }
    const result = await getJourneyChatService().send({
      userId: user.id,
      message: parsed.data.message,
      threadId: parsed.data.threadId,
      enhanced: parsed.data.enhanced
    });
    if(reserved){
      // Only bill successful Gemini-selected tool responses. A deterministic
      // fallback remains free even when Enhanced AI was requested.
      await finishSparksUsage(user.id,key,result.message.agentMode==="gemini-read-plan-v1");
      reserved=null;
    }

    return ok(requestId, result, result.actionProposal ? {
      notifications: [{
        title: "Confirmation required",
        message: "Journey Chat proposed an action but did not execute it.",
        tone: "info"
      }]
    } : undefined);
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return fail(requestId, 401, "UNAUTHENTICATED", "Sign in to use Journey Chat.");
    }

    if(reserved){
      try{await finishSparksUsage(reserved.userId,reserved.key,false);}
      catch(refundError){console.error("sparks.chat.refund.failed",{requestId,error:refundError instanceof Error?refundError.message:"unknown"});}
    }
    const message = error instanceof Error ? error.message : String(error);
    if (message === "CHAT_THREAD_NOT_FOUND") {
      return fail(requestId, 404, "CHAT_THREAD_NOT_FOUND", "Chat thread not found.");
    }

    console.error("journey.chat.failed", { requestId, error: message });
    return fail(requestId, 500, "JOURNEY_CHAT_FAILED", "Could not answer this journey question.");
  }
}

export async function GET(request: Request) {
  const requestId = await getRequestId();

  try {
    const { user } = await requireUser();
    const query = Object.fromEntries(new URL(request.url).searchParams.entries());
    const parsed = getSchema.safeParse(query);
    if (!parsed.success) {
      return fail(requestId, 400, "VALIDATION_ERROR", "Invalid chat query.");
    }

    if (parsed.data.threadId) {
      return ok(requestId, await getJourneyChatService().getThread(user.id, parsed.data.threadId));
    }

    return ok(requestId, {
      threads: await getJourneyChatService().listThreads(user.id)
    });
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return fail(requestId, 401, "UNAUTHENTICATED", "Sign in to use Journey Chat.");
    }

    const message = error instanceof Error ? error.message : String(error);
    if (message === "CHAT_THREAD_NOT_FOUND") {
      return fail(requestId, 404, "CHAT_THREAD_NOT_FOUND", "Chat thread not found.");
    }

    console.error("journey.chat.read.failed", { requestId, error: message });
    return fail(requestId, 500, "JOURNEY_CHAT_READ_FAILED", "Could not load Journey Chat.");
  }
}
