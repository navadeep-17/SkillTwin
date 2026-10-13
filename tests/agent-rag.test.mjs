import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {retrieveProjectPassages,renderProjectRagResult,shouldRetrieveProjectCode,codeQuestionWithoutProjectName,selectSavedCodeProject} from "../dist/lib/domain/agent-rag.js";
import {classifyJourneyIntent} from "../dist/lib/domain/journey-intent.js";
import {isMutatingJourneyIntent} from "../dist/lib/domain/agent-read-plan.js";
const sha="a".repeat(40),blob="b".repeat(40);
const mk=(path,excerpt)=>({
  path,excerpt,blobSha:blob,startLine:1,endLine:30,
  sourceUrl:"https://github.com/sample/app/blob/"+sha+"/"+path+"#L1-L30"
});
test("source RAG ranks relevant observed authentication code and preserves pinned citations",()=>{
  const sources=[
    mk("src/models/train.py","def train_model(dataset): return fit(dataset)"),
    mk("src/auth/login.ts","export function authenticateUser(token) { return verifyToken(token); }"),
    mk("src/db/query.ts","function connectDatabase() { return pool; }")
  ];
  const hits=retrieveProjectPassages("How is authentication implemented?",sources);
  assert.equal(hits.length,1);
  assert.equal(hits[0].source.path,"src/auth/login.ts");
  const answer=renderProjectRagResult("sample/app",sha,hits);
  assert.match(answer,/login\.ts/);
  assert.match(answer,/blob\/a{40}\/src\/auth\/login.ts#L1-L30/);
  assert.match(answer,/do not prove who wrote the code/);
});
test("no fabricated answers or links for unsupported questions",()=>{
  const hits=retrieveProjectPassages("Where are the Kubernetes deployment manifests?",[
    mk("src/auth/login.ts","export const login = () => true")
  ]);
  assert.deepEqual(hits,[]);
  assert.match(renderProjectRagResult("sample/app",sha,hits),/could not find a passage/);
});
test("sources must have safe provenance and bounded excerpts",()=>{
  const bad=[mk("src/a.ts","authentication")];
  bad[0].sourceUrl="https://evil.example/prompt";
  assert.deepEqual(retrieveProjectPassages("authentication",bad),[]);
  const giant=[mk("src/a.ts","authentication ".repeat(500))];
  assert.deepEqual(retrieveProjectPassages("authentication",giant),[]);
});
test("project retrieval remains user-scoped, server-owned and read-only",()=>{
  const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
  const service=read("lib/services/chat/project-code-rag.ts");
  const orchestrator=read("lib/services/chat/agent-read-orchestrator.ts");
  const journey=read("lib/services/chat/journey-chat-service.ts");
  assert.match(service,/where user_id=\$1::uuid/);
  assert.match(service,/parsePublicGitHubRepo/);
  assert.match(service,/inspectPublicRepository/);
  assert.match(orchestrator,/readSavedProjectCode/);
  assert.match(orchestrator,/SKILLTWIN_AGENT_V3_RAG_ENABLED === "true"/, "RAG must be explicitly enabled on the server before real account reads");
  assert.match(journey,/!isMutatingJourneyIntent\(intent\)/);
  assert.doesNotMatch(service,/getEvidenceEngine|getAssessmentService|getInitialPlanService|delete from|insert into/);
});

test("only explicit code questions trigger project retrieval",()=>{
  assert.equal(shouldRetrieveProjectCode("How was authentication implemented in my project?"),true);
  assert.equal(shouldRetrieveProjectCode("Show me the source code from my GitHub repo"),true);
  assert.equal(shouldRetrieveProjectCode("Find the sorting algorithm in this repository"),true);
  assert.equal(shouldRetrieveProjectCode("What is my current skill score?"),false);
  assert.equal(shouldRetrieveProjectCode("Why is project evidence confidence low?"),false);
  assert.equal(shouldRetrieveProjectCode("How does my project affect ML Engineer career readiness?"),false);
  assert.equal(shouldRetrieveProjectCode("Build my project learning plan"),false);
});


test("forged source URL cannot enter retrieval or receive a citation",()=>{
  const wrongPath=mk("src/auth/login.ts","function authenticateUser() { return true; }");
  wrongPath.sourceUrl=wrongPath.sourceUrl.replace("src/auth/login.ts","src/auth/other.ts");
  const wrongLines=mk("src/auth/login.ts","function authenticateUser() { return true; }");
  wrongLines.sourceUrl=wrongLines.sourceUrl.replace("#L1-L30","#L1-L29");
  const misleadingHost=mk("src/auth/login.ts","function authenticateUser() { return true; }");
  misleadingHost.sourceUrl="https://github.com.attacker.invalid/sample/app/blob/"+sha+"/src/auth/login.ts#L1-L30";
  for(const altered of [wrongPath,wrongLines,misleadingHost]){
    assert.deepEqual(retrieveProjectPassages("authentication code", [altered]),[]);
  }
});

test("cross-repository and cross-commit hits cannot be presented as verified proof",()=>{
  const source=mk("src/auth/login.ts","function authenticateUser() { return true; }");
  const hits=retrieveProjectPassages("How does authentication work in my repo?",[source]);
  assert.equal(hits.length,1);
  assert.match(renderProjectRagResult("another/repository",sha,hits,"An unverified claim."),/cannot verify/);
  assert.match(renderProjectRagResult("sample/app","c".repeat(40),hits,"An unverified claim."),/cannot verify/);
  assert.doesNotMatch(renderProjectRagResult("sample/app","c".repeat(40),hits,"An unverified claim."),/An unverified claim/);
});

test("encoded source filenames resolve to precisely pinned repository lines",()=>{
  const path="src/security/token helper.ts";
  const source=mk(path,"function authenticateUser(token) { return verify(token); }");
  source.sourceUrl="https://github.com/sample/app/blob/"+sha+"/src/security/token%20helper.ts#L1-L30";
  const hits=retrieveProjectPassages("How is authentication handled in project code?",[source]);
  assert.equal(hits.length,1);
  assert.match(renderProjectRagResult("sample/app",sha,hits),/token%20helper\.ts#L1-L30/);
});


test("selection labels cannot create false technical matches in unrelated source",()=>{
  const question=codeQuestionWithoutProjectName(
    "Where is the zzqvvindigoops function in my Backend Demo GitHub project?",
    "Backend Demo","example/backend-demo"
  );
  assert.doesNotMatch(question,/backend demo/i);
  assert.ok(question.includes("zzqvvindigoops"));
  const sources=[mk("src/backend-demo/main.ts","export function startServer() { return true; }")];
  assert.deepEqual(retrieveProjectPassages(question,sources),[],
    "Unknown concept plus generic function words must not invent a match");
});

test("removing short repository names must not corrupt longer technical words",()=>{
  const question=codeQuestionWithoutProjectName(
    "How is authentication handled inside my auth repository?",
    "A sample app","sample/auth"
  );
  assert.match(question,/authentication/i);
  assert.doesNotMatch(question,/\bauth\b/i);
  const sources=[mk("src/server/login.ts","function authenticateUser(token) { return verify(token); }")];
  assert.equal(retrieveProjectPassages(question,sources).length,1);
});

test("optional model summary cannot inject unrelated clickable source URLs",()=>{
  const source=mk("src/auth/login.ts","function authenticateUser(token) { return verify(token); }");
  const hits=retrieveProjectPassages("How is authentication implemented?",[source]);
  const answer=renderProjectRagResult("sample/app",sha,hits,
    "The helper validates tokens; see https://attacker.example/fake-proof and https://github.com/another/repo/blob/"+sha+"/bogus.ts#L1-L99");
  assert.doesNotMatch(answer,/attacker\.example|another\/repo/);
  assert.match(answer,/unverified link omitted/);
  assert.match(answer,/https:\/\/github\.com\/sample\/app\/blob\//);
});


test("ordinary repository code questions remain in the existing read-only intent lane",()=>{
  for(const question of [
    "Explain the authentication logic in my project repository",
    "Find the sorting implementation in my GitHub codebase",
    "How is the API server implemented in my project files?"
  ]) {
    assert.equal(shouldRetrieveProjectCode(question),true);
    assert.equal(isMutatingJourneyIntent(classifyJourneyIntent(question)),false);
  }
  for(const request of ["Generate my project learning roadmap","Challenge me on my skills"]) {
    assert.equal(shouldRetrieveProjectCode(request),false);
  }
});

test("single learner-owned public repository is selected deterministically",()=>{
  const a={id:"a",title:"Auth Service",repository:"me/auth-service"};
  assert.deepEqual(selectSavedCodeProject("How is the login implemented in my project?",[a]),{
    status:"SELECTED",project:a
  });
});

test("multiple saved GitHub projects require an unambiguous title or repository",()=>{
  const projects=[
    {id:"a",title:"App",repository:"alpha/app"},
    {id:"b",title:"Application Server",repository:"beta/application-server"},
    {id:"c",title:"ML Pipeline",repository:"gamma/ml-pipeline"}
  ];
  assert.equal(selectSavedCodeProject("Explain my codebase",projects).status,"AMBIGUOUS");
  assert.equal(selectSavedCodeProject("How does authentication work in application-server repo?",projects).status,"SELECTED");
  assert.equal(selectSavedCodeProject("Find code in ML Pipeline",projects).project.id,"c");
  assert.equal(selectSavedCodeProject("Show me code in both App and ML Pipeline",projects).status,"AMBIGUOUS");
  assert.equal(selectSavedCodeProject("Review beta/application-server repository",projects).project.id,"b");
  assert.deepEqual(selectSavedCodeProject("Review my repo",[]),{status:"NONE"});
});

test("short project names cannot match substrings of longer code concepts",()=>{
  const candidates=[
    {id:"auth",title:"Auth",repository:"owner/auth"},
    {id:"other",title:"Other Project",repository:"owner/other"}
  ];
  assert.equal(selectSavedCodeProject("Explain authentication design in my project",candidates).status,"AMBIGUOUS");
  assert.equal(selectSavedCodeProject("Inspect auth repository",candidates).project.id,"auth");
});
