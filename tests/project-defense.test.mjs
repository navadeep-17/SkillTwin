import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  parsePublicGitHubRepo,eligibleSourcePath,rankedSourcePaths,
  buildGroundedQuestions,validatedAnswerSet
} from "../dist/lib/domain/project-defense.js";

test("only exact public github.com owner/repo URLs are accepted",()=>{
  assert.deepEqual(parsePublicGitHubRepo("https://github.com/navadeep-17/SkillTwin"),{owner:"navadeep-17",repo:"SkillTwin"});
  assert.deepEqual(parsePublicGitHubRepo("https://github.com/acme/tool.git"),{owner:"acme",repo:"tool"});
  for(const url of [
    "http://github.com/acme/repo","https://github.com.evil.com/acme/repo",
    "https://github.com@evil.com/acme/repo","https://github.com/acme/repo/tree/main",
    "https://github.com/acme/repo?token=secret","https://github.com/acme/repo#fragment",
    "https://github.com/acme/../repo","https://api.github.com/repos/acme/repo",
    "file:///etc/passwd","https://github.com/acme/.env","https://github.com:444/acme/repo"
  ])assert.equal(parsePublicGitHubRepo(url),null,url);
});
test("inspection accepts source files, filters deps, tests and generated artifacts",()=>{
  assert.equal(eligibleSourcePath("src/services/train.py"),true);
  assert.equal(eligibleSourcePath("app/api/route.ts"),true);
  assert.equal(eligibleSourcePath("src/auth.test.ts"),false);
  assert.equal(eligibleSourcePath("node_modules/x.js"),false);
  assert.equal(eligibleSourcePath("dist/bundle.js"),false);
  assert.equal(eligibleSourcePath("../secrets.py"),false);
  assert.equal(eligibleSourcePath("app/.env"),false);
  const files=[
    {path:"src/model.py",size:900,sha:"b".repeat(40)},
    {path:"tests/model.py",size:900,sha:"c".repeat(40)},
    {path:"src/route.ts",size:1800,sha:"d".repeat(40)},
    {path:"src/large.ts",size:19000,sha:"e".repeat(40)}
  ];
  assert.deepEqual(rankedSourcePaths(files).map(x=>x.path),["src/model.py","src/route.ts"]);
});
const sha="a".repeat(40);
const sources=[1,2,3].map(i=>({
  path:"src/file"+i+".py",blobSha:"b".repeat(40),startLine:1,endLine:12,
  excerpt:"def f(): return 1",
  sourceUrl:"https://github.com/acme/repo/blob/"+sha+"/src/file"+i+".py#L1-L12"
}));
test("three deterministic questions require actual source citations",()=>{
  const questions=buildGroundedQuestions("acme","repo",sha,sources);
  assert.equal(questions.length,3);
  assert.deepEqual(questions.map(x=>x.id),["defense-q1","defense-q2","defense-q3"]);
  assert.ok(questions.every(q=>q.rubric.length===3&&q.prompt.includes(q.path)));
  assert.throws(()=>buildGroundedQuestions("acme","repo",sha,[{...sources[0],sourceUrl:"https://evil.example.com"}]),/INVALID_PROVENANCE/);
});
test("all three answers require valid ids, order, and minimally explained reasoning",()=>{
  const questions=buildGroundedQuestions("acme","repo",sha,sources);
  const answers=questions.map(q=>({questionId:q.id,answer:"This implementation would require testing the actual branch behavior, input contracts and error paths."}));
  assert.equal(validatedAnswerSet(questions,answers),true);
  assert.equal(validatedAnswerSet(questions,answers.slice(0,2)),false);
  assert.equal(validatedAnswerSet(questions,[answers[1],answers[0],answers[2]]),false);
  assert.equal(validatedAnswerSet(questions,answers.map(a=>({...a,answer:"I did it"}))),false);
  assert.equal(validatedAnswerSet(questions,answers.map(a=>({...a,answer:"x".repeat(4001)}))),false);
});
test("pilot never treats AI review as trusted evidence or writes a capability score",()=>{
  const service=readFileSync(new URL("../lib/services/projects/project-defense-service.ts",import.meta.url),"utf8");
  const routes=[
    "../app/api/project-defense/inspect/route.ts",
    "../app/api/project-defense/evaluate/route.ts"
  ].map(path=>readFileSync(new URL(path,import.meta.url),"utf8"));
  assert.match(service,/does not verify authorship|NOT an authorship verifier/i);
  assert.match(service,/REPOSITORY_CHANGED_RESTART/);
  assert.match(service,/snapshot\.questions\[i\]\.id/);
  assert.doesNotMatch(service,/getEvidenceEngine|ingestBatch|insert into|update public\.user_skills/);
  assert.ok(routes.every(s=>s.includes("requireUser()")));
});
