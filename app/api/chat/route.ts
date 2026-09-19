import { z } from "zod";
import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getJourneyChatService } from "@/lib/services/chat/journey-chat-service";

const postSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  threadId: z.string().uuid().nullable().optional()
});

const getSchema = z.object({
  threadId: z.string().uuid().optional()
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = await getRequestId();

  try {
    const { user } = await requireUser();
    const parsed = postSchema.safeParse(await request.json());
    if (!parsed.success) {
      return fail(requestId, 400, "VALIDATION_ERROR", "Invalid chat message.", parsed.error.flatten().fieldErrors);
    }

    const result = await getJourneyChatService().send({
      userId: user.id,
      message: parsed.data.message,
      threadId: parsed.data.threadId
    });

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
