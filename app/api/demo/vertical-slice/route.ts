import { getRequestId } from "@/lib/api/request-context";
import { ok } from "@/lib/api/responses";
import { runVerticalSlice } from "@/lib/domain/demo";

export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = await getRequestId();
  return ok(requestId, runVerticalSlice());
}
