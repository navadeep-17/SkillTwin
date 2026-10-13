
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildMappingReviewQueue,
  validateMappingReviewManifest,
  suggestCanonicalSkills,
  reviewKey
} from "../dist/lib/domain/occupation-mapping.js";

const source = JSON.parse(readFileSync(new URL("../data/occupations/onet-online-curated-2026-10-13-v1.json", import.meta.url)));
const catalog = JSON.parse(readFileSync(new URL("../data/occupation-mappings/canonical-skill-snapshot-v2.json", import.meta.url)));
const manifest = JSON.parse(readFileSync(new URL("../data/occupation-mappings/review-decisions-v2.json", import.meta.url)));
const decision = (overrides = {}) => ({
  sourceSkillKey: reviewKey("Active Listening", "ESSENTIAL"),
  decision: "APPROVED", canonicalSkillSlug: "user-research",
  reviewer: "@test-reviewer", reviewedAt: "2026-10-13T10:00:00.000Z",
  rationale: "The reviewer compared the documented source concept against the canonical definition before making this manual decision.",
  ...overrides
});

test("mapping queue preserves O*NET source provenance and starts unapproved", () => {
  const queue = buildMappingReviewQueue(source, catalog, manifest);
  assert.ok(queue.length > 15 && queue.length < 108);
  assert.ok(queue.every(item => item.status === "PENDING" && item.review === null));
  const listening = queue.find(x => x.sourceSkillKey === reviewKey("Active Listening", "ESSENTIAL"));
  assert.ok(listening?.sourceOccupations.length > 1);
  assert.ok(listening.sourceOccupations.every(x => x.url.startsWith("https://www.onetonline.org/link/details/")));
  assert.deepEqual(validateMappingReviewManifest(source, catalog, manifest), []);
});

test("lexical candidates do not imply approved semantic equivalence", () => {
  assert.equal(suggestCanonicalSkills("Python", catalog.skills)[0]?.slug, "python");
  assert.deepEqual(suggestCanonicalSkills("Active Listening", catalog.skills), []);
  assert.ok(buildMappingReviewQueue(source,catalog,manifest).every(x => x.status !== "APPROVED"));
});

test("approval without an existing canonical skill is rejected", () => {
  const invalid={...manifest,decisions:[decision({canonicalSkillSlug:"missing"})]};
  assert.match(validateMappingReviewManifest(source,catalog,invalid).join("; "), /existing canonical slug/);
});

test("decision requires identifiable reviewer, rationale and UTC timestamp", () => {
  const invalid={...manifest,decisions:[decision({reviewer:"anonymous",rationale:"yes",reviewedAt:"yesterday"})]};
  const errors=validateMappingReviewManifest(source,catalog,invalid).join("; ");
  assert.match(errors,/reviewer/);
  assert.match(errors,/rationale/);
  assert.match(errors,/ISO UTC/);
});

test("wrong source version, duplicate key, and unknown key are rejected", () => {
  const d=decision();
  const invalid={...manifest,sourceSnapshotId:"other",decisions:[d,d,decision({sourceSkillKey:"ESSENTIAL::invented"})]};
  const errors=validateMappingReviewManifest(source,catalog,invalid).join("; ");
  assert.match(errors,/version mismatch/);
  assert.match(errors,/Duplicate/);
  assert.match(errors,/Unrecognized/);
});

test("non-approval may not reference a canonical skill", () => {
  const invalid={...manifest,decisions:[decision({decision:"REJECTED"})]};
  assert.match(validateMappingReviewManifest(source,catalog,invalid).join("; "),/Non-approval/);
});

test("a valid human decision changes mapping status without creating readiness", () => {
  const reviewed={...manifest,decisions:[decision()]};
  assert.deepEqual(validateMappingReviewManifest(source,catalog,reviewed),[]);
  const item=buildMappingReviewQueue(source,catalog,reviewed).find(x=>x.sourceSkillKey===reviewKey("Active Listening","ESSENTIAL"));
  assert.equal(item?.status,"APPROVED");
  assert.equal(item?.review?.canonicalSkillSlug,"user-research");
  assert.equal(Object.hasOwn(item??{},"readiness"),false);
});
