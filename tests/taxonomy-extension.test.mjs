import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateMappingReviewManifest, buildMappingReviewQueue } from "../dist/lib/domain/occupation-mapping.js";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const parse = path => JSON.parse(read(path));
const base=parse("../data/occupation-mappings/canonical-skill-snapshot-v1.json");
const v2=parse("../data/occupation-mappings/canonical-skill-snapshot-v2.json");
const additions=parse("../data/occupation-mappings/cross-domain-skill-additions-v2.json");
const oldLedger=parse("../data/occupation-mappings/review-decisions-v1.json");
const ledger=parse("../data/occupation-mappings/review-decisions-v2.json");
const source=parse("../data/occupations/onet-online-curated-2026-10-13-v1.json");
const migration=read("../supabase/migrations/0024_cross_domain_taxonomy_v2.sql");

test("taxonomy v2 extends, but does not alter, any of the 36 existing canonical entries", () => {
  assert.equal(base.skills.length,36);
  assert.equal(additions.skills.length,17);
  assert.equal(v2.skills.length,53);
  assert.equal(v2.snapshotId, additions.targetSnapshotId);
  const bySlug=new Map(v2.skills.map(s=>[s.slug,s]));
  assert.equal(bySlug.size,v2.skills.length);
  for(const skill of base.skills) assert.deepEqual(bySlug.get(skill.slug),skill);
  for(const skill of additions.skills) {
    assert.deepEqual(bySlug.get(skill.slug),{
      slug:skill.slug,name:skill.name,category:skill.category,taxonomyVersion:2
    });
    assert.ok(skill.description.length>=45);
    assert.equal(skill.assessmentStatus,"UNASSESSED");
    assert.equal(skill.mappingStatus,"NOT_REVIEWED");
  }
});

test("cross-domain labels are grounded in the selected O*NET source snapshot", () => {
  const names=new Set(source.occupations.flatMap(o=>
    [...o.essentialSkills,...o.transferableSkills].map(x=>x.name)
  ));
  for(const skill of additions.skills)assert.ok(names.has(skill.sourceSkillName),skill.slug);
  assert.equal(additions.sourceOccupationSnapshotId,source.snapshotId);
  assert.equal(additions.status,"CURATED_TAXONOMY_ONLY");
});

test("migration inserts every curated skill and avoids learner state mutations", () => {
  const sql=migration.toLowerCase().replace(/--[^\n]*/g,"");
  assert.match(sql,/begin;[\s\S]+lock table public\.skills/);
  assert.match(sql,/on conflict\(slug\) do nothing/);
  assert.match(sql,/taxonomy_v2_existing_skill_conflict/);
  assert.match(sql,/taxonomy_v2_postcheck_failed/);
  assert.match(sql,/commit;/);
  assert.doesNotMatch(sql,/\b(insert\s+into|update|delete\s+from|truncate)\s+public\.(user_skills|skill_evidence|skill_history|role_skill_requirements|skill_assessments|career_goals|learning_plans)/);
  for(const skill of additions.skills) {
    const literal = "'" + skill.slug.replaceAll("'","''") + "'";
    assert.ok(migration.includes(literal), "Migration lacks "+skill.slug);
    assert.ok(migration.includes("'" + skill.description.replaceAll("'","''") + "'"), "Definition mismatch "+skill.slug);
  }
});

test("mapping review switches to v2 while v1 history remains valid", () => {
  assert.deepEqual(validateMappingReviewManifest(source,base,oldLedger),[]);
  assert.deepEqual(validateMappingReviewManifest(source,v2,ledger),[]);
  assert.equal(ledger.decisions.length,0);
  assert.equal(ledger.canonicalSnapshotId,v2.snapshotId);
  assert.notEqual(base.snapshotId,v2.snapshotId);
  const queue=buildMappingReviewQueue(source,v2,ledger);
  assert.ok(queue.length>15);
  assert.ok(queue.every(item=>item.status==="PENDING"));
  const activeListening=queue.find(x=>x.sourceName==="Active Listening");
  assert.ok(activeListening);
  assert.equal(activeListening.suggestions[0]?.slug,"active-listening");
  assert.equal(activeListening.suggestions[0]?.method,"EXACT_LABEL");
  assert.equal(activeListening.status,"PENDING");
});
