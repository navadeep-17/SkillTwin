import { z } from "zod";
import { requireUser, UnauthenticatedError } from "@/lib/auth/require-user";
import { getRequestId } from "@/lib/api/request-context";
import { fail, ok } from "@/lib/api/responses";
import { rankLiveJobs, type JobicyRecord } from "@/lib/domain/live-job-matching";
import { getSql } from "@/lib/db/postgres";
import { recommendEmployerJobs, type StoredEmployerJob } from "@/lib/jobs/recommend-employer-jobs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const paramsSchema = z.object({
  q: z.string().trim().max(75).optional(),
  region: z.enum(["all","anywhere","apac","india"]).default("all"),
  hideSenior: z.enum(["true","false"]).default("true")
});
const single = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0]??null : value??null;

type RoleJoin = {target_roles?: {name?:string} | Array<{name?:string}> | null};
type SkillJoin = {canonical_name?:string;slug?:string};

export async function GET(request:Request) {
  const requestId = await getRequestId();
  try{
    const {user,supabase} = await requireUser();
    const url=new URL(request.url);
    const parsed=paramsSchema.safeParse({
      q:url.searchParams.get("q")??undefined,
      region:url.searchParams.get("region")??"all",
      hideSenior:url.searchParams.get("hideSenior")??"true"
    });
    if(!parsed.success) return fail(requestId,400,"INVALID_JOB_FILTER","Check the role or location filter.");

    // Profiles are scoped to the authenticated owner; no PII is sent to Jobicy.
    const [goalResult,skillsResult]=await Promise.all([
      supabase.from("career_goals")
        .select("role_version_id,role_versions!inner(target_roles!inner(name))")
        .eq("user_id",user.id).eq("status","ACTIVE").limit(1).maybeSingle(),
      supabase.from("user_skills")
        .select("level_value,skills!inner(canonical_name,slug)")
        .eq("user_id",user.id).limit(200)
    ]);
    if(goalResult.error) throw goalResult.error;
    if(skillsResult.error) throw skillsResult.error;

    const roleVersion=single(goalResult.data?.role_versions as RoleJoin|RoleJoin[]|null);
    const activeRole=single(roleVersion?.target_roles)?.name?.trim()??null;
    const explicit=parsed.data.q?.trim();
    const role=explicit||activeRole||"Software Engineer";
    const recorded=(skillsResult.data??[])
      .filter(x=>x.level_value!=="UNKNOWN")
      .map(x=>single(x.skills as SkillJoin|SkillJoin[]|null)?.canonical_name??"")
      .filter(Boolean);

    // Employer ATS listings are collected periodically, not fetched during user page views.
    // Gracefully fall back to Jobicy until the additive ATS migration is installed.
    let employerJobs: ReturnType<typeof rankLiveJobs>=[];
    let employerCheckedAt: string|null=null;
    let employerCatalogAvailable=false;
    try{
      const rows=await getSql().unsafe(`
        select provider,board,external_id,title,company,location,workplace_type,
          employment_type,description,posting_url,published_at,first_seen_at,last_seen_at
        from public.ats_job_postings
        where is_active=true and last_seen_at>now()-interval '30 hours'
        order by last_seen_at desc limit 600
      `);
      employerCatalogAvailable=rows.length>0;
      const recent=rows[0]?.last_seen_at;
      employerCheckedAt=recent instanceof Date?recent.toISOString()
        :typeof recent==="string"?recent:null;
      employerJobs=recommendEmployerJobs({
        rows:rows as unknown as StoredEmployerJob[],
        role,recordedSkills:recorded,region:parsed.data.region,
        hideSenior:parsed.data.hideSenior==="true",limit:12
      });
    }catch(err){
      // Migration not yet installed or database temporarily unavailable.
      // Do not report fabricated employer vacancies.
      console.warn("jobs.ats_catalog.unavailable",{
        requestId,reason:err instanceof Error?err.name:"unknown"
      });
    }

    let sourceUpdatedAt: string|null=null;
    let jobs: ReturnType<typeof rankLiveJobs>=[];
    let available=employerCatalogAvailable;
    try{
      // Use a fixed provider endpoint: never interpolate client/profile text in a fetch URL.
      // Cached once per hour across learners (not once per learner). The API itself is private.
      const response=await fetch("https://jobicy.com/api/v2/remote-jobs?count=100",{
        headers:{Accept:"application/json"},
        next:{revalidate:3600},
        signal:AbortSignal.timeout(7000)
      });
      if(!response.ok)throw new Error("PROVIDER_HTTP_"+response.status);
      const payload:unknown=await response.json();
      if(!payload||typeof payload!=="object"||Array.isArray(payload))throw new Error("PROVIDER_INVALID");
      const body=payload as Record<string,unknown>;
      if(body.success===false || !Array.isArray(body.jobs))throw new Error("PROVIDER_INVALID");
      available=true;
      const asDate=typeof body.lastUpdate==="string"?new Date(body.lastUpdate):null;
      sourceUpdatedAt=asDate&&Number.isFinite(asDate.getTime())?asDate.toISOString():null;
      jobs=rankLiveJobs({
        records:body.jobs as JobicyRecord[],
        role,recordedSkills:recorded,
        region:parsed.data.region,hideSenior:parsed.data.hideSenior==="true",
        limit:12
      });
    }catch(err){
      console.warn("jobs.feed.unavailable",{requestId,reason:err instanceof Error?err.message:"unknown"});
    }

    // Prefer original employer postings; Jobicy remains a useful broader fallback.
    const combined=[...employerJobs,...jobs].slice(0,12);
    return ok(requestId,{
      jobs:combined,available,roleUsed:role,
      basedOnActiveGoal:!explicit&&Boolean(activeRole),
      recordedSkillCount:recorded.length,
      filter:{region:parsed.data.region,hideSenior:parsed.data.hideSenior==="true"},
      source:{name:employerCatalogAvailable?"Company boards + Jobicy":"Jobicy",
        url:"https://jobicy.com/jobs-rss-feed",
        coverage:"Verified employer job boards (Greenhouse, Lever, Ashby) when refreshed; Jobicy supplements remote coverage. Not every company or campus drive is covered.",
        sourceUpdatedAt:employerCheckedAt??sourceUpdatedAt,refreshIntervalMinutes:60},
      disclaimer:"Keyword-based relevance only. Recorded skills can be self-reported. Verify location, experience, eligibility and availability with the employer."
    });
  }catch(error){
    if(error instanceof UnauthenticatedError)return fail(requestId,401,"UNAUTHENTICATED","Sign in to view relevant jobs.");
    console.error("jobs.recommendations.failed",{requestId,error:error instanceof Error?error.message:String(error)});
    return fail(requestId,500,"JOBS_UNAVAILABLE","Could not load your personalized job recommendations.");
  }
}
