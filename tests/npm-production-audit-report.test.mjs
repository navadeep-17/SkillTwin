import test from "node:test";
import assert from "node:assert/strict";
import {summarizeAudit} from "../scripts/npm-production-audit-report.mjs";

test("reports only provided production advisory facts and does not fake missing data",()=>{
  const data={metadata:{vulnerabilities:{high:1,moderate:1,total:2}},vulnerabilities:{
    packageA:{severity:"high",isDirect:true,range:"<2.0.0",fixAvailable:{name:"packageA",version:"2.0.0"},via:[{source:12345}]},
    packageB:{severity:"moderate",isDirect:false,range:"*",fixAvailable:false,via:["packageA"]}
  }};
  const r=summarizeAudit(data);
  assert.equal(r.status,"AUDIT_AVAILABLE");
  assert.deepEqual(r.counts,{high:1,moderate:1,total:2});
  assert.deepEqual(r.packages.map(x=>x.name),["packageA","packageB"]);
  assert.deepEqual(r.packages[0].advisoryIds,["12345"]);
  assert.equal(r.packages[0].fixAvailable,"packageA@2.0.0");
  assert.equal(r.packages[1].fixAvailable,false);
  assert.equal(summarizeAudit({error:{code:"ENOAUDIT"}}).status,"UNAVAILABLE");
});
