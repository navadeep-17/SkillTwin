import { getRequestId } from "@/lib/api/request-context";
import { ok } from "@/lib/api/responses";
import { getDeploymentIdentity } from "@/lib/runtime/deployment";

export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = await getRequestId();
  const deployment = getDeploymentIdentity();

  return ok(requestId, {
    status: "ok",
    service: "skilltwin-web",
    ...deployment
  });
}
