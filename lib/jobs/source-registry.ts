/**
 * Human-reviewed, company-specific public job boards.
 * Never accept tokens/URLs from learners or an AI model.
 * Review board identities before expanding this list.
 */
export type AtsProvider = "greenhouse" | "lever" | "ashby";
export type JobSource = Readonly<{
  id: string;
  provider: AtsProvider;
  token: string;
  company: string;
  boardUrl: string;
  enabled: boolean;
}>;

export const JOB_SOURCES: readonly JobSource[] = [
  {id:"greenhouse:redwoodsoftware",provider:"greenhouse",token:"redwoodsoftware",company:"Redwood Software",boardUrl:"https://job-boards.greenhouse.io/redwoodsoftware",enabled:true},
  {id:"greenhouse:doordashindia",provider:"greenhouse",token:"doordashindia",company:"DoorDash India",boardUrl:"https://job-boards.greenhouse.io/doordashindia",enabled:true},
  {id:"greenhouse:truveta",provider:"greenhouse",token:"truveta",company:"Truveta",boardUrl:"https://job-boards.greenhouse.io/truveta",enabled:true},
  {id:"greenhouse:zenoti",provider:"greenhouse",token:"zenoti",company:"Zenoti",boardUrl:"https://job-boards.greenhouse.io/zenoti",enabled:true},
  {id:"lever:acceldata",provider:"lever",token:"acceldata",company:"Acceldata",boardUrl:"https://jobs.lever.co/acceldata",enabled:true},
  {id:"lever:saviynt",provider:"lever",token:"saviynt",company:"Saviynt",boardUrl:"https://jobs.lever.co/saviynt",enabled:true},
  {id:"ashby:Astronomer",provider:"ashby",token:"Astronomer",company:"Astronomer",boardUrl:"https://jobs.ashbyhq.com/Astronomer",enabled:true}
] as const;

const TOKEN_PATTERN=/^[A-Za-z0-9_-]{2,80}$/;
export function validateSource(source: JobSource):void {
  if(!TOKEN_PATTERN.test(source.token)||!TOKEN_PATTERN.test(source.company.replace(/[^A-Za-z0-9_-]/g,"")))
    throw new Error("INVALID_REVIEWED_JOB_SOURCE");
  if(source.id!==source.provider+":"+source.token)throw new Error("SOURCE_ID_MISMATCH");
  const u=new URL(source.boardUrl);
  const host=source.provider==="greenhouse"?"job-boards.greenhouse.io"
    :source.provider==="lever"?"jobs.lever.co":"jobs.ashbyhq.com";
  if(u.protocol!=="https:"||u.hostname!==host||u.pathname!=="/"+source.token
      ||u.search||u.hash||u.username||u.password)throw new Error("SOURCE_URL_MISMATCH");
}

/** Construct a fixed-host feed endpoint, preventing redirects to arbitrary sites. */
export function feedUrl(source:JobSource,skip=0):string {
  validateSource(source);
  if(!Number.isSafeInteger(skip)||skip<0||skip>500)throw new Error("BAD_PAGE");
  if(source.provider==="greenhouse")return "https://boards-api.greenhouse.io/v1/boards/"+source.token+"/jobs?content=true";
  if(source.provider==="lever")return "https://api.lever.co/v0/postings/"+source.token+"?mode=json&limit=100&skip="+skip;
  return "https://api.ashbyhq.com/posting-api/job-board/"+source.token+"?includeCompensation=false";
}
