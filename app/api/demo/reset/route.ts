import { createHash, timingSafeEqual } from "node:crypto";
import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getServerEnv } from "@/lib/config/env";
import { getDemoResetService } from "@/lib/services/demo/demo-reset-service";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

function secretMatches(provided:string,expected:string){
  const a=createHash("sha256").update(provided).digest();
  const b=createHash("sha256").update(expected).digest();
  return timingSafeEqual(a,b);
}

export async function POST(request:Request){
  const requestId=await getRequestId();

  try{
    const {user,supabase}=await requireUser();
    const env=getServerEnv();

    if(env.DEMO_FALLBACK_ENABLED!=="true" || !env.DEMO_RESET_SECRET){
      return fail(requestId,404,"NOT_FOUND","Demo reset is not enabled.");
    }

    const provided=request.headers.get("x-skilltwin-demo-secret") ?? "";
    if(!provided || !secretMatches(provided,env.DEMO_RESET_SECRET)){
      return fail(requestId,403,"FORBIDDEN","Invalid demo reset credential.");
    }

    const result=await getDemoResetService().reset({
      userId:user.id,
      supabase,
      commitSha:process.env.VERCEL_GIT_COMMIT_SHA ?? null
    });

    return ok(requestId,result,{
      notifications:[{
        title:"DEMO READY",
        message:"The learner was reset and the deterministic Backend Engineer baseline passed invariant verification.",
        tone:"success"
      }],
      next_action:{type:"OPEN_OVERVIEW",label:"Open demo baseline",href:"/overview"}
    });
  }catch(error){
    if(error instanceof UnauthenticatedError){
      return fail(requestId,401,"UNAUTHENTICATED","Sign in before resetting demo state.");
    }

    console.error("demo.reset.failed",{
      requestId,
      error:error instanceof Error?error.message:String(error)
    });
    return fail(requestId,500,"DEMO_RESET_FAILED","Could not reset and verify this demo learner safely.");
  }
}
