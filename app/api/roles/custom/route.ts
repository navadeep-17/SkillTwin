import { z } from "zod";
import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getRoleService } from "@/lib/services/roles/role-service";

const schema=z.object({
  roleName:z.string().trim().min(2).max(120),
  levelContext:z.enum(["ENTRY","MID","ADVANCED"]).default("ENTRY"),
  goalDescription:z.string().trim().max(1500).nullable().optional()
});

export const runtime="nodejs";
export const maxDuration=60;
export const dynamic="force-dynamic";

export async function POST(request:Request) {
  const requestId=await getRequestId();
  try {
    const {user}=await requireUser();
    const parsed=schema.safeParse(await request.json());
    if (!parsed.success) return fail(requestId,400,"VALIDATION_ERROR","Invalid custom role request.",parsed.error.flatten().fieldErrors);
    const result=await getRoleService().generateCustom({
      userId:user.id,
      roleName:parsed.data.roleName,
      levelContext:parsed.data.levelContext,
      goalDescription:parsed.data.goalDescription
    });
    return ok(requestId,result,{
      notifications:[{title:"Custom role ready",message:"SkillTwin validated the generated role model against the canonical skill taxonomy.",tone:"success"}]
    },201);
  } catch (error) {
    if (error instanceof UnauthenticatedError) return fail(requestId,401,"UNAUTHENTICATED","Sign in to generate a custom role.");
    const message=error instanceof Error ? error.message : String(error);
    if (message==="AI_NOT_CONFIGURED") return fail(requestId,503,"AI_NOT_CONFIGURED","Custom role generation requires the configured AI provider.");
    if (message==="ROLE_VALIDATION_FAILED") return fail(requestId,422,"ROLE_VALIDATION_FAILED","The generated role could not pass deterministic validation after one repair attempt.");
    console.error("role.custom.failed",{requestId,error:message});
    return fail(requestId,500,"CUSTOM_ROLE_FAILED","Could not generate this custom role.");
  }
}
