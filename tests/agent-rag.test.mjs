import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {retrieveProjectPassages,renderProjectRagResult,shouldRetrieveProjectCode} from "../dist/lib/domain/agent-rag.js";
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
