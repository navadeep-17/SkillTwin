import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  validateDraftModelManifest, buildDraftModelSummaries
} from "../dist/lib/domain/reviewed-career-model.js";

const parse = path => JSON.parse(readFileSync(new URL(path,import.meta.url),"utf8"));
const source=parse("../data/occupations/onet-online-curated-2026-10-13-v1.json");
const catalog=parse("../data/occupation-mappings/canonical-skill-snapshot-v2.json");
const originalLedger=parse("../data/occupation-mappings/review-decisions-v2.json");
const originalDraft=parse("../data/occupation-models/draft-models-v1.json");
const copy=value=>structuredClone(value);
const approvedLedger=()=>{
  const ledger=copy(originalLedger);
  ledger.decisions.push({
    sourceSkillKey:"ESSENTIAL::active listening",
    decision:"APPROVED",canonicalSkillSlug:"active-listening",
    reviewer:"@independent-reviewer",reviewedAt:"2026-10-13T11:00:00.000Z",
    rationale:"Compared the occupation's Active Listening definition with the exact canonical competency definition."
  });
  return ledger;
};
const row=()=>({
  sourceSkillKey:"ESSENTIAL::active listening",
  canonicalSkillSlug:"active-listening",
  groupType:"SINGLE",
  targetScore:2, importance:0.75, importanceBand:"IMPORTANT",learningStage:2,
  rationale:"Human reviewer identified and documented a proposed ability target for this draft role model.",
  reviewer:"@independent-reviewer",reviewedAt:"2026-10-13T12:00:00.000Z"
});

test("production draft catalog contains nine blocked exploratory occupations and zero fabricated approvals",()=>{
  assert.deepEqual(validateDraftModelManifest(source,catalog,originalLedger,originalDraft),[]);
  assert.equal(originalDraft.models.length,9);
  const summaries=buildDraftModelSummaries(source,catalog,originalLedger,originalDraft);
  assert.equal(summaries.length,9);
  for(const item of summaries) {
    assert.equal(item.status,"EXPLORATORY");
    assert.equal(item.sourceSkillCount,12);
    assert.equal(item.approvedMappings,0);
    assert.equal(item.configuredRequirements,0);
    assert.equal(item.draftRequirementCount,0);
    assert.ok(item.blockers.some(x=>x.includes("assessment coverage")));
    assert.ok(item.blockers.some(x=>x.includes("No approved activation")));
    assert.equal(Object.hasOwn(item,"readiness"),false);
  }
});

test("reviewed mapping alone does not author a requirement or produce proficiency",()=>{
  const summary=buildDraftModelSummaries(source,catalog,approvedLedger(),originalDraft)[0];
  assert.equal(summary.approvedMappings,1);
  assert.equal(summary.configuredRequirements,0);
  assert.equal(summary.sourceSkills.find(x=>x.sourceSkillKey==="ESSENTIAL::active listening")?.targetScore,null);
  assert.ok(summary.blockers.some(x=>x.includes("Human-authored proficiency")));
});

test("valid reviewed target is a DRAFT only and remains blocked from activation",()=>{
  const draft=copy(originalDraft);
  draft.models[0].requirements.push(row());
  assert.deepEqual(validateDraftModelManifest(source,catalog,approvedLedger(),draft),[]);
  const summary=buildDraftModelSummaries(source,catalog,approvedLedger(),draft)[0];
  assert.equal(summary.configuredRequirements,1);
  assert.equal(summary.status,"EXPLORATORY");
  assert.ok(summary.blockers.some(x=>x.includes("professional licensing")));
  assert.ok(summary.blockers.some(x=>x.includes("assessment coverage")));
  assert.ok(summary.blockers.some(x=>x.includes("No approved activation")));
});

test("rejects a requirement relying on an unapproved exact-label mapping",()=>{
  const draft=copy(originalDraft);
  draft.models[0].requirements.push(row());
  assert.match(validateDraftModelManifest(source,catalog,originalLedger,draft).join("; "),/needs approved source-to-canonical mapping/);
});

test("rejects wrong canonical identity, duplicate requirements and unsourced skills",()=>{
  const draft=copy(originalDraft);
  draft.models[0].requirements.push(row(), {...row()});
  const result=validateDraftModelManifest(source,catalog,approvedLedger(),draft).join("; ");
  assert.match(result,/Duplicate draft requirement/);
  draft.models[0].requirements=[{...row(),canonicalSkillSlug:"python"}];
  assert.match(validateDraftModelManifest(source,catalog,approvedLedger(),draft).join("; "),/needs approved source-to-canonical mapping/);
  draft.models[0].requirements=[{...row(),sourceSkillKey:"ESSENTIAL::nonexistent"}];
  assert.match(validateDraftModelManifest(source,catalog,approvedLedger(),draft).join("; "),/not present in sourced occupation/);
});

test("draft configuration rejects out of range numbers, unsourced alternatives and incomplete reviewer metadata",()=>{
  const draft=copy(originalDraft);
  draft.models[0].requirements=[{...row(),targetScore:5,importance:1.2,groupType:"ANY_OF",reviewer:"anonymous"}];
  const errors=validateDraftModelManifest(source,catalog,approvedLedger(),draft).join("; ");
  assert.match(errors,/Invalid proposed proficiency/);
  assert.match(errors,/Invalid proposed importance/);
  assert.match(errors,/Alternatives need separate expert group review/);
  assert.match(errors,/Partial or unreviewed/);
});

test("source-version drift, attempted activation and non-US claims are rejected",()=>{
  const draft=copy(originalDraft);
  draft.sourceSnapshotId="unknown";
  draft.models[0].status="ACTIVE";
  draft.models[0].jurisdiction="India";
  const errors=validateDraftModelManifest(source,catalog,originalLedger,draft).join("; ");
  assert.match(errors,/source version mismatch/);
  assert.match(errors,/EXPLORATORY US context/);
});
