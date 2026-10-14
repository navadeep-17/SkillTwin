import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sparksChargingAllowed } from "../lib/domain/sparks-canary.ts";
const tester="9a975693-3c7b-4a7a-9c39-646ff76281f1";
const outsider="72b0825d-bc9c-49cf-b3d5-02d32d5f8012";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("default global OFF and no canary means zero credit deductions",()=>{
  assert.equal(sparksChargingAllowed({}),false);
  assert.equal(sparksChargingAllowed({globalFlag:"false"}),false);
  assert.equal(sparksChargingAllowed({globalFlag:"TRUE",userId:tester}),false);
  assert.equal(sparksChargingAllowed({globalFlag:"true"}),true);
});

test("canary flag allows exact authenticated user UUID only",()=>{
  assert.equal(sparksChargingAllowed({globalFlag:"false",canaryIds:tester,userId:tester}),true);
  assert.equal(sparksChargingAllowed({globalFlag:"false",canaryIds:tester,userId:outsider}),false);
  assert.equal(sparksChargingAllowed({globalFlag:"false",canaryIds:" invalid , "+tester.toUpperCase()+" ",userId:tester}),true);
  assert.equal(sparksChargingAllowed({globalFlag:"false",canaryIds:tester+"DROP TABLE",userId:tester}),false);
  assert.equal(sparksChargingAllowed({globalFlag:"false",canaryIds:tester}),false);
  assert.equal(sparksChargingAllowed({globalFlag:"false",canaryIds:tester,userId:""}),false);
  assert.equal(sparksChargingAllowed({globalFlag:"false",canaryIds:tester,userId:tester.slice(0,15)}),false);
  assert.equal(sparksChargingAllowed({globalFlag:"false",canaryIds:"",userId:tester}),false);
});

test("both wallet quote and backend charges use user-specific canary decision",()=>{
  const service=read("lib/services/sparks/sparks-service.ts");
  const consumption=read("lib/services/sparks/sparks-consumption.ts");
  const api=read("app/api/sparks/route.ts");
  assert.match(service,/chargingEnabled: isSparksChargingEnabled\(userId\)/);
  assert.match(service,/if \(!isSparksChargingEnabled\(userId\)\) return/);
  assert.match(consumption,/if\(!isSparksChargingEnabled\(input.userId\)\) return/);
  assert.match(consumption,/enhancedReplyCostNow:isSparksChargingEnabled\(userId\)/);
  assert.match(consumption,/resumeCostNow:isSparksChargingEnabled\(userId\)/);
  assert.match(api,/requireUser\(\)/);
  assert.doesNotMatch(api,/canaryIds/);
});
