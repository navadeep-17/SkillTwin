import { getRequestId } from "@/lib/api/request-context";
import { ok } from "@/lib/api/responses";

export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = await getRequestId();
  return ok(requestId, {
    status: "ok",
    service: "skilltwin-web",
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? "local"
  });
}
