"use server";

import { getServerEnv } from "@/lib/config/env";
import { requireUser } from "@/lib/auth/require-user";
import { getDemoResetService } from "@/lib/services/demo/demo-reset-service";

export async function resetOwnDemoState(){
  const env=getServerEnv();
  if(env.DEMO_FALLBACK_ENABLED!=="true" || !env.DEMO_RESET_SECRET){
    return {ok:false,error:"Demo reset is not enabled on this deployment."};
  }

  try{
    const {user,supabase}=await requireUser();
    const result=await getDemoResetService().reset({
      userId:user.id,
      supabase,
      commitSha:process.env.VERCEL_GIT_COMMIT_SHA ?? null
    });
    return {ok:true,result};
  }catch(error){
    console.error("demo.reset.action.failed",{error:error instanceof Error?error.message:String(error)});
    return {ok:false,error:"Could not reset and verify the demo learner."};
  }
}
