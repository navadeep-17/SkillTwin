import {z} from "zod";
import {getRequestId} from "@/lib/api/request-context";
import {fail,ok} from "@/lib/api/responses";
import {requireUser,UnauthenticatedError} from "@/lib/auth/require-user";
import {inspectPublicRepository} from "@/lib/services/projects/project-defense-service";

const schema=z.object({repoUrl:z.string().max(250)});
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:Request){
  const requestId=await getRequestId();
  try{
    await requireUser();
    const input=schema.safeParse(await request.json());
    if(!input.success)return fail(requestId,400,"INVALID_INPUT","Provide a public github.com/owner/repository URL.");
    const result=await inspectPublicRepository(input.data.repoUrl);
    return ok(requestId,result);
  }catch(error){
    if(error instanceof UnauthenticatedError)return fail(requestId,401,"UNAUTHENTICATED","Sign in to inspect a project.");
    const code=error instanceof Error?error.message:"PROJECT_DEFENSE_UNAVAILABLE";
    const known:Record<string,[number,string]>={
      INVALID_PUBLIC_REPOSITORY_URL:[400,"Use a public GitHub repository URL in the form https://github.com/owner/repo."],
      PUBLIC_REPOSITORY_NOT_FOUND:[404,"This repository is unavailable without authentication. Private repositories are not supported."],
      GITHUB_RATE_LIMIT:[429,"Public GitHub request limit reached. Please retry later."],
      INSUFFICIENT_CODE_FILES:[422,"We need at least three small, inspectable source files in this repository."],
      REPOSITORY_TOO_LARGE:[422,"This repository is outside the pilot's inspection limits."],
      UNSUPPORTED_SOURCE_FILE:[422,"A selected source file could not be safely inspected."]
    };
    if(known[code])return fail(requestId,known[code][0],code,known[code][1]);
    console.error("project.defense.inspect.failed",{requestId,code});
    return fail(requestId,502,"PUBLIC_REPOSITORY_INSPECTION_FAILED","Unable to safely inspect this public repository.");
  }
}
