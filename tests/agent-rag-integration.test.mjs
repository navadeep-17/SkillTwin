import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runProjectCodeRag} from "../dist/lib/domain/agent-rag-flow.js";

const commit="a".repeat(40),blob="b".repeat(40);
const project={id:"11111111-1111-4111-8111-111111111111",title:"Backend Demo",
  artifact_url:"https://github.com/example/backend-demo"};
const source={
  path:"src/auth/login.ts",
  blobSha:blob,startLine:1,endLine:30,
  excerpt:"export function authenticateUser(token) { return verifyToken(token); }",
  sourceUrl:"https://github.com/example/backend-demo/blob/"+commit+"/src/auth/login.ts#L1-L30"
};
const snapshot={repository:"example/backend-demo",commitSha:commit,sources:[source]};
const q="Explain the authentication logic in my Backend Demo GitHub source code";

test("offline end-to-end RAG pipeline retrieves a saved project, synthesizes and cites pinned code",async()=>{
  const visited=[],prompts=[];
  const output=await runProjectCodeRag({question:q,projects:[project]},{
    inspect:async url=>{visited.push(url);return snapshot;},
    synthesize:async (question,hits)=>{
      prompts.push({question,hits});
      return "The shown authenticateUser function checks its token with verifyToken.";
    }
  });
  assert.deepEqual(visited,[project.artifact_url]);
  assert.equal(prompts.length,1);
  assert.equal(prompts[0].hits[0].source.path,"src/auth/login.ts");
  assert.equal(output.meta.generator,"source-rag-gemini-v1");
  assert.equal(output.refs[0].id,project.id);
  assert.ok(output.content.includes("https://github.com/example/backend-demo/blob/"+commit));
  assert.match(output.content,/checks its token/);
  assert.doesNotMatch(output.content,/authentication logic in my Backend Demo/);
});

test("unavailable Gemini retains actual citation and does not invent a summary",async()=>{
  const output=await runProjectCodeRag({question:q,projects:[project]},{
    inspect:async()=>snapshot,
    synthesize:async()=>{throw new Error("EXTERNAL_AI_UNAVAILABLE");}
  });
  assert.equal(output.meta.generator,"source-rag-fallback-v1");
  assert.match(output.content,/src\/auth\/login.ts/);
  assert.match(output.content,/cannot conclusively explain behavior/);
});

test("no-source queries abstain; no model call occurs",async()=>{
  let synthesized=false;
  const output=await runProjectCodeRag({
    question:"Find the zzqvvindigoops algorithm in Backend Demo GitHub code.",
    projects:[project]
  },{
    inspect:async()=>snapshot,
    synthesize:async()=>{synthesized=true;return "Invented algorithm";}
  });
  assert.equal(synthesized,false);
  assert.match(output.content,/could not find a passage/);
  assert.doesNotMatch(output.content,/https:\/\/github\.com\/example\/backend-demo\/blob/);
});

test("no saved projects, unknown GitHub repository, and ambiguity never trigger a network read",async()=>{
  let inspections=0;
  const inspect=async()=>{inspections++;return snapshot;};
  const synthesize=async()=>"Never reached";
  const absent=await runProjectCodeRag({question:q,projects:[]},{inspect,synthesize});
  assert.match(absent.content,/could not find a saved public/);
  const external=await runProjectCodeRag({
    question:"Explain https://github.com/other/private-repo code",
    projects:[project]
  },{inspect,synthesize});
  assert.match(external.content,/not one of your saved public projects/);
  const more={...project,id:"22222222-2222-4222-8222-222222222222",title:"Second Demo",artifact_url:"https://github.com/example/second-demo"};
  const ambiguous=await runProjectCodeRag({
    question:"Explain the authentication logic in my GitHub project code",
    projects:[project,more]
  },{inspect,synthesize});
  assert.match(ambiguous.content,/multiple saved public GitHub projects/);
  assert.equal(inspections,0);
});

test("forged repository in inspector response cannot be accepted as saved learner proof",async()=>{
  let modelCalled=false;
  const output=await runProjectCodeRag({question:q,projects:[project]},{
    inspect:async()=>({...snapshot,repository:"attacker/unrelated"}),
    synthesize:async()=>{modelCalled=true;return "Forged summary";}
  });
  assert.equal(modelCalled,false);
  assert.match(output.content,/cannot verify/);
  assert.doesNotMatch(output.content,/Forged summary/);
});

test("GitHub API errors stay bounded, do not dispatch actions or leak source exceptions",async()=>{
  const output=await runProjectCodeRag({question:q,projects:[project]},{
    inspect:async()=>{throw new Error("API_TOKEN_PRIVATE_SHOULD_NEVER_LEAK");},
    synthesize:async()=>{throw new Error("Unexpected model call");}
  });
  assert.match(output.content,/could not safely retrieve verified public code/);
  assert.doesNotMatch(output.content,/PRIVATE_SHOULD_NEVER_LEAK/);
  assert.equal(output.meta.generator,"source-rag-fallback-v1");
  assert.deepEqual(output.refs,[{type:"profile_project",id:project.id,label:project.title}]);
  assert.equal("action" in output,false);
});

test("read-only database adapter scopes all project rows to authenticated user, never the model",()=>{
  const service=readFileSync(new URL("../lib/services/chat/project-code-rag.ts",import.meta.url),"utf8");
  const orchestrator=readFileSync(new URL("../lib/services/chat/agent-read-orchestrator.ts",import.meta.url),"utf8");
  const send=readFileSync(new URL("../lib/services/chat/journey-chat-service.ts",import.meta.url),"utf8");
  assert.match(service,/where user_id=\$1::uuid/);
  assert.match(service,/\[input\.userId\]/);
  assert.match(service,/runProjectCodeRag/);
  assert.match(orchestrator,/SKILLTWIN_AGENT_V3_RAG_ENABLED === "true"/);
  assert.match(send,/!isMutatingJourneyIntent\(intent\)/);
  assert.doesNotMatch(service,/getEvidenceEngine|getAssessmentService|getInitialPlanService|insert into|delete from/);
});
