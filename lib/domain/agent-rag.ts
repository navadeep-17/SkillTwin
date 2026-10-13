/** Pure, bounded retrieval for code-backed agent answers. No DB, network or LLM access here. */
export type RagCodeSource = {
  path:string;
  excerpt:string;
  startLine:number;
  endLine:number;
  sourceUrl:string;
  blobSha:string;
};
export type RagHit = {source:RagCodeSource;score:number;matchedTerms:string[]};

const STOP_WORDS=new Set([
  "what","which","when","where","who","why","how","does","did","do","can",
  "could","would","should","please","tell","show","explain","about","with",
  "from","that","this","these","there","their","into","were","have","has",
  "my","our","your","the","and","for","are","was","code","source","file",
  "files","project","repo","repository","github","implementation","implemented",
  "function","functions","algorithm","algorithms","logic","architecture","design","review","bug",
  "locate","find","search","works","working","used","using"
]);
function canonical(term:string):string {
  const word=term.toLowerCase();
  if(/^(auth|authentication|authenticate|authorization|authorize)$/.test(word))return "auth";
  if(/^(test|tests|testing)$/.test(word))return "test";
  if(/^(train|trained|training)$/.test(word))return "train";
  if(/^(model|models|modeling)$/.test(word))return "model";
  if(/^(deploy|deployed|deployment)$/.test(word))return "deploy";
  if(/^(database|databases|db)$/.test(word))return "database";
  return word;
}
function tokens(text:string):string[] {
  return [...new Set((text.toLowerCase().match(/[a-z0-9+#.]+/g)??[])
    .map(canonical)
    .filter(term=>term.length>=3 && !STOP_WORDS.has(term)))].slice(0,16);
}
function containsToken(haystack:string,term:string):boolean {
  return haystack.includes(term);
}
/**
 * A citation must resolve to the same saved public repository, pinned
 * commit, exact encoded path, and visible line interval. A GitHub hostname
 * alone is not enough to establish the provenance of an answer.
 */
function matchesSourceClaim(repository:string,commitSha:string,source:RagCodeSource):boolean {
  if(!/^[a-f0-9]{40}$/i.test(commitSha))return false;
  const match=/^([A-Za-z0-9-]+)\/([A-Za-z0-9_.-]+)$/.exec(repository);
  if(!match || !source.path || source.path.startsWith("/") ||
    source.path.includes("\\") || source.path.split("/").some(part=>!part||part==="."||part==="..") ||
    !Number.isInteger(source.startLine)||!Number.isInteger(source.endLine)||
    source.startLine<1||source.endLine<source.startLine)return false;
  const encoded=source.path.split("/").map(encodeURIComponent).join("/");
  return source.sourceUrl===
    "https://github.com/"+match[1]+"/"+match[2]+"/blob/"+commitSha+"/"+encoded+
    "#L"+source.startLine+"-L"+source.endLine;
}

/** Reject a forged/mis-stated citation before the excerpt reaches synthesis. */
function hasCanonicalPinnedCitation(source:RagCodeSource):boolean {
  const match=/^https:\/\/github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9_.-]+)\/blob\/([a-f0-9]{40})\//i.exec(source.sourceUrl);
  return Boolean(match && matchesSourceClaim(match[1]+"/"+match[2],match[3],source));
}

/**
 * A saved project title is a selection hint, not evidence that the source
 * contains the concepts the user is asking about. Ignore project identifiers
 * as retrieval keywords while preserving terms embedded in larger words.
 */
export function codeQuestionWithoutProjectName(
  question:string,projectTitle:string,repository:string
):string {
  const repoName=repository.split("/").pop()??"";
  const keys=[repository,projectTitle,repoName]
    .map(value=>value.trim()).filter(value=>value.length>=3)
    .sort((a,b)=>b.length-a.length);
  let text=question;
  for(const key of keys){
    let offset=0;
    while(offset<text.length){
      const index=text.toLowerCase().indexOf(key.toLowerCase(),offset);
      if(index<0)break;
      const left=index===0||!/\w/.test(text[index-1]);
      const right=index+key.length===text.length||!/\w/.test(text[index+key.length]);
      if(left&&right){
        text=text.slice(0,index)+" "+text.slice(index+key.length);
        offset=index+1;
      }else offset=index+key.length;
    }
  }
  return text;
}

/** Rank ONLY existing inspected, pinned, public source snippets. No speculative retrieval. */
export function retrieveProjectPassages(
  question:string,sources:readonly RagCodeSource[],limit=2
):RagHit[] {
  const terms=tokens(question);
  if(!terms.length)return [];
  const bounded=Math.max(1,Math.min(3,Math.trunc(limit)||2));
  return sources.flatMap(source=>{
    if(!source.path || !hasCanonicalPinnedCitation(source)
      || !/^[a-f0-9]{40}$/i.test(source.blobSha)
      || !Number.isInteger(source.startLine) || !Number.isInteger(source.endLine)
      || source.endLine<source.startLine || source.excerpt.length>5000)return [];
    const pathTokens=tokens(source.path.replaceAll("/"," "));
    const path=source.path.toLowerCase();
    const body=source.excerpt.toLowerCase();
    const hits=terms.filter(t=>containsToken(path,t)||containsToken(body,t)
      || (t==="auth"&&(/authenticat|authoriz/.test(body)||/authenticat|authoriz/.test(path))));
    if(!hits.length)return [];
    const score=hits.reduce((sum,t)=>sum+
      (containsToken(path,t)||pathTokens.includes(t)?5:0)+
      (containsToken(body,t)||t==="auth"&&/authenticat|authoriz/.test(body)?2:0),0);
    return [{source,score,matchedTerms:hits}];
  }).sort((a,b)=>b.score-a.score || a.source.path.localeCompare(b.source.path)).slice(0,bounded);
}
export function renderProjectRagResult(
  repository:string,commitSha:string,hits:readonly RagHit[],generatedSummary?:string|null
):string {
  if(!hits.length)return "I inspected the available bounded code excerpts but could not find a passage matching your question. The current pilot reads up to three source files, not the entire repository. I cannot infer unseen implementation.";
  const verified=hits.filter(hit=>matchesSourceClaim(repository,commitSha,hit.source));
  if(!verified.length)return "I cannot verify that the retrieved excerpts belong to the specified repository, commit and line range. No source-backed conclusion can be made.";
  // Model-generated text may summarize evidence, but may not introduce URLs.
  const summary=generatedSummary?.trim().replace(/https?:\/\/\S+/gi,"[unverified link omitted]").slice(0,850);
  const intro=summary
    ? "Based on the retrieved public code (not verified authorship): "+summary+"\n\n"
    : "I found relevant code passages, but cannot conclusively explain behavior beyond these excerpts:\n\n";
  const lines=verified.map(({source},i)=>
    "Source "+(i+1)+": "+source.path+" (lines "+source.startLine+"–"+source.endLine+")\n"+
    source.sourceUrl+"\n"+
    "Excerpt: "+source.excerpt.replace(/\s+/g," ").trim().slice(0,350));
  return intro+"Repository: "+repository+" at commit "+commitSha.slice(0,12)+"\n"+
    lines.join("\n\n")+"\n\nOnly inspected code is cited; these excerpts do not prove who wrote the code or establish proficiency.";
}

/** Route explicit code-search questions only; never hijack skill, plan or readiness questions. */
export function shouldRetrieveProjectCode(question:string):boolean {
  const text=question.toLowerCase().replace(/\s+/g," ").trim();
  if(!/\b(project|repo|repository|github|codebase)\b/.test(text))return false;
  if(/\b(readiness|career|confidence|score|assessment|roadmap|learning plan|skill gap|progress)\b/.test(text))return false;
  return /\b(code|source|file|files|function|functions|implement|implemented|implementation|algorithm|logic|pipeline|architecture|auth|authentication|design|security|bug|review)\b/.test(text);
}


/** Tenant filtering happens in SQL first. This helper selects ONLY among those saved rows. */
export type SavedCodeProject={
  id:string;title:string;repository:string;
};
export type SavedCodeProjectSelection=
  | {status:"NONE"}
  | {status:"AMBIGUOUS";titles:string[]}
  | {status:"SELECTED";project:SavedCodeProject};

function hasWholeProjectLabel(question:string,label:string):boolean {
  const needle=label.trim().toLowerCase();
  if(needle.length<3)return false;
  const hay=question.toLowerCase();
  let from=0;
  while(from<hay.length){
    const at=hay.indexOf(needle,from);
    if(at<0)return false;
    const after=at+needle.length;
    const isNameChar=(character:string)=>/[a-z0-9_.-]/.test(character);
    if((at===0||!isNameChar(hay[at-1]))&&
       (after===hay.length||!isNameChar(hay[after])))return true;
    from=after;
  }
  return false;
}

/** Never guess a project when multiple account-owned candidates remain. */
export function selectSavedCodeProject(
  question:string,projects:readonly SavedCodeProject[]
):SavedCodeProjectSelection {
  if(!projects.length)return {status:"NONE"};
  if(projects.length===1)return {status:"SELECTED",project:projects[0]};
  const exact=projects.filter(project=>{
    const [owner,name]=project.repository.split("/");
    return Boolean(owner && name &&
      (hasWholeProjectLabel(question,owner+"/"+name) ||
       hasWholeProjectLabel(question,name) ||
       hasWholeProjectLabel(question,project.title)));
  });
  if(exact.length===1)return {status:"SELECTED",project:exact[0]};
  return {
    status:"AMBIGUOUS",
    titles:projects.slice(0,8).map(project=>project.title)
  };
}
