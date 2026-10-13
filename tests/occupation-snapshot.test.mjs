import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateOccupationSnapshot } from "../scripts/occupation-snapshot-validation.mjs";

const file = new URL("../data/occupations/onet-online-curated-2026-10-13-v1.json", import.meta.url);
const fixture = JSON.parse(readFileSync(file, "utf8"));
const clone = () => structuredClone(fixture);

test("curated O*NET snapshot contains attributed, exploratory careers across fields", () => {
  assert.deepEqual(validateOccupationSnapshot(fixture), []);
  assert.equal(fixture.occupations.length, 9);
  assert.ok(new Set(fixture.occupations.map(item => item.family)).size >= 8);
  assert.ok(fixture.occupations.every(item => item.countryContext === "US"));
});

test("rejects duplicate occupation codes and misaligned source URLs", () => {
  const bad = clone();
  bad.occupations[1].onetSocCode = bad.occupations[0].onetSocCode;
  const errors = validateOccupationSnapshot(bad).join("; ");
  assert.match(errors, /duplicate occupational ID/);
  assert.match(errors, /official source URL does not match code/);
});

test("rejects unsupported verification and unreviewed skill mappings", () => {
  const bad = clone();
  bad.occupations[0].status = "VERIFIED";
  bad.occupations[0].essentialSkills[0].mappingStatus = "APPROVED";
  bad.occupations[0].essentialSkills[0].skillTwinSkillId = "made-up";
  const errors = validateOccupationSnapshot(bad).join("; ");
  assert.match(errors, /cannot be promoted to verified/);
  assert.match(errors, /unreviewed skill was presented as mapped/);
  assert.match(errors, /unauthorized mapping or verification field/);
});

test("rejects missing source attribution or licensing", () => {
  const bad = clone();
  bad.licenseUrl = "https://example.com/license";
  bad.modificationNote = "";
  assert.match(validateOccupationSnapshot(bad).join("; "), /license|endorsement/);
});

test("validation never edits source snapshot", () => {
  const before = JSON.stringify(fixture);
  assert.deepEqual(validateOccupationSnapshot(fixture), []);
  assert.equal(JSON.stringify(fixture), before);
});
