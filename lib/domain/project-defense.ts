/**
 * Source-grounded public GitHub project defense. This is a review interview,
 * NOT verified authorship, skill certification, or trusted learner evidence.
 */
export type DefenseSource = {
  path: string;
  blobSha: string;
  startLine: number;
  endLine: number;
  excerpt: string;
  sourceUrl: string;
};
export type DefenseQuestion = {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  sourceUrl: string;
  prompt: string;
  rubric: string[];
};
export type DefenseSnapshot = {
  repository: string;
  commitSha: string;
  sourceCount: number;
  sources: DefenseSource[];
  questions: DefenseQuestion[];
  limitations: string[];
};
export function parsePublicGitHubRepo(input: string): {owner:string;repo:string}|null {
  if (typeof input !== "string" || input.length>250) return null;
  let url:URL;
  try {url=new URL(input)}catch{return null}
  if(url.protocol!=="https:"||url.hostname!=="github.com"||url.port||url.username||url.password||url.search||url.hash)return null;
  const segments=url.pathname.split("/").filter(Boolean);
  if(segments.length!==2)return null;
  const [owner,rawRepo]=segments;
  const repo=rawRepo.replace(/\.git$/i,"");
  if(!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(owner))return null;
  if(!/^[A-Za-z0-9_.-]{1,100}$/.test(repo)||repo==="."||repo===".."||repo.startsWith("."))return null;
  return {owner,repo};
}
export function eligibleSourcePath(path:string):boolean {
  if(!/\.(py|ts|tsx|js|jsx|sql)$/i.test(path))return false;
  if(path.length>200||path.includes("\\")||path.startsWith("/")||path.split("/").some(s=>s===".."||s==="."))return false;
  if(/(^|\/)(node_modules|\.next|dist|build|coverage|vendor|venv|\.venv|generated|__pycache__|fixtures|migrations|tests?|\.github)(\/|$)/i.test(path))return false;
  if(/(^|\/)(package-lock|yarn\.lock|pnpm-lock|.*\.min\.(js|ts)|.*\.test\.(js|ts|tsx)|.*\.spec\.(js|ts|tsx))$/i.test(path))return false;
  return true;
}
export function rankedSourcePaths(files:{path:string;size:number;sha:string}[]):typeof files {
  const score=(p:string)=>{
    const name=p.toLowerCase();
    let s=0;
    if(/(^|\/)(src|app|backend|server|ml|lib|api|models|pipelines)(\/|$)/.test(name))s+=6;
    if(/(service|train|model|api|pipeline|auth|main|server|app|preprocess|feature|router)/.test(name))s+=4;
    if(/\.(py|ts|tsx)$/.test(name))s+=2;
    s-=p.split("/").length;
    return s;
  };
  return files.filter(x=>eligibleSourcePath(x.path)&&x.size>=120&&x.size<=12000&&/^[a-f0-9]{40}$/i.test(x.sha))
    .sort((a,b)=>score(b.path)-score(a.path)||a.path.localeCompare(b.path));
}
export function buildGroundedQuestions(
  owner:string,repo:string,commitSha:string,
  sources:DefenseSource[]
):DefenseQuestion[] {
  return sources.slice(0,3).map((s,i)=>{
    const patterns = [
      {
        prompt:`Walk me through the logic in ${s.path} (lines ${s.startLine}–${s.endLine}). Which inputs, transformations and outputs matter, and which specific lines support your explanation?`,
        rubric:["Explains the actual shown data/control flow","Cites code details accurately","Distinguishes shown behavior from assumptions"]
      },
      {
        prompt:`What design trade-off did you make in ${s.path} (lines ${s.startLine}–${s.endLine})? Explain one reasonable alternative and when it would be preferable.`,
        rubric:["Identifies a real design choice visible in the excerpt","Explains trade-offs rather than listing tools","Does not invent implementation details"]
      },
      {
        prompt:`What could go wrong in the code shown in ${s.path} (lines ${s.startLine}–${s.endLine})? Propose one test and a practical improvement using the referenced implementation.`,
        rubric:["Describes a plausible failure or edge case grounded in code","Proposes a concrete test with an observable result","Provides a feasible improvement and limits its claims"]
      }
    ][i];
    const expected=`https://github.com/${owner}/${repo}/blob/${commitSha}/`;
    if(!s.sourceUrl.startsWith(expected))throw new Error("INVALID_PROVENANCE");
    return {id:`defense-q${i+1}`,path:s.path,startLine:s.startLine,endLine:s.endLine,sourceUrl:s.sourceUrl,
      prompt:patterns.prompt,rubric:patterns.rubric};
  });
}
export function validatedAnswerSet(questions:DefenseQuestion[],answers:{questionId:string;answer:string}[]):boolean {
  return questions.length===3&&answers.length===3&&
    questions.every((q,i)=>answers[i].questionId===q.id&&typeof answers[i].answer==="string"&&
      answers[i].answer.trim().length>=40&&answers[i].answer.length<=4000);
}
