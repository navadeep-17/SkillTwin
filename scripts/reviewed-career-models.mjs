#!/usr/bin/env node
/**
 * Git-reviewed occupational model draft operations. This tool never writes to
 * Supabase or activates a role. Run npm run build:core before invoking.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildDraftModelSummaries, validateDraftModelManifest } from "../dist/lib/domain/reviewed-career-model.js";
import { buildMappingReviewQueue } from "../dist/lib/domain/occupation-mapping.js";

const base = process.cwd();
const paths = {
  source: resolve(base, "data/occupations/onet-online-curated-2026-10-13-v1.json"),
  catalog: resolve(base, "data/occupation-mappings/canonical-skill-snapshot-v2.json"),
  ledger: resolve(base, "data/occupation-mappings/review-decisions-v2.json"),
  drafts: resolve(base, "data/occupation-models/draft-models-v1.json")
};
const load = path => JSON.parse(readFileSync(path,"utf8"));
const source = load(paths.source), catalog = load(paths.catalog);
const ledger = load(paths.ledger), draft = load(paths.drafts);

const command = process.argv[2] ?? "status";
if (!["status","scaffold","configure"].includes(command)) throw Error("Expected status, scaffold or configure");
const flags = {};
const args = process.argv.slice(3);
if (args.length % 2 !== 0) throw Error("Flags must be paired: --name value");
for (let i = 0; i < args.length; i += 2) {
  if (!args[i].startsWith("--") || flags[args[i].slice(2)] !== undefined) throw Error("Invalid or repeated flag");
  flags[args[i].slice(2)] = args[i+1];
}
const check = () => {
  const errors = validateDraftModelManifest(source,catalog,ledger,draft);
  if (errors.length) throw Error("Invalid role-model draft manifest:\n" + errors.join("\n"));
};
check();
const findModel = () => {
  const model = draft.models.find(x => x.occupationId === flags.occupation);
  if (!model) throw Error("Unknown --occupation. Use status for available IDs.");
  return model;
};
const save = () => {
  check();
  writeFileSync(paths.drafts,JSON.stringify(draft,null,2)+"\n","utf8");
  console.log("Draft updated locally only. Submit a reviewed GitHub PR. No active career model was created.");
};

if (command === "status") {
  console.log(JSON.stringify({
    sourceSnapshot:source.snapshotId,
    canonicalSnapshot:catalog.snapshotId,
    note:"Exploratory draft only; no activation, qualifications, assessments or learner state.",
    occupations:buildDraftModelSummaries(source,catalog,ledger,draft).map(x=>({
      occupationId:x.occupationId,name:x.name,
      approvedMappings:x.approvedMappings,
      configuredRequirements:x.configuredRequirements,
      sourceSkills:x.sourceSkillCount,blockers:x.blockers
    }))
  },null,2));
}

if (command === "scaffold") {
  const model = findModel();
  const queue=buildMappingReviewQueue(source,catalog,ledger);
  const keys=new Set(model.requirements.map(x=>x.sourceSkillKey));
  const approved=queue.filter(x=>
    x.review?.decision==="APPROVED" &&
    x.sourceOccupations.some(o=>o.occupationId===model.occupationId)
  );
  let added=0;
  for (const item of approved) {
    if (keys.has(item.sourceSkillKey)) continue;
    model.requirements.push({
      sourceSkillKey:item.sourceSkillKey,
      canonicalSkillSlug:item.review.canonicalSkillSlug,
      groupType:"SINGLE",
      targetScore:null,importance:null,importanceBand:null,learningStage:null,
      rationale:"",reviewer:null,reviewedAt:null
    });
    keys.add(item.sourceSkillKey); added++;
  }
  model.requirements.sort((a,b)=>a.sourceSkillKey.localeCompare(b.sourceSkillKey));
  if (added) save();
  else console.log("No new human-approved skill mappings for this occupation. Nothing modified.");
}

if (command === "configure") {
  const model=findModel();
  const requirement=model.requirements.find(x=>x.sourceSkillKey===flags.key);
  if (!requirement) throw Error("No approved-scaffold requirement for --key. Run scaffold after mappings have been approved.");
  if (requirement.reviewedAt) throw Error("Already reviewed: changes require a documented supersession PR.");
  const targetScore=Number(flags.target),importance=Number(flags.importance),learningStage=Number(flags.stage);
  if (!["CORE","IMPORTANT","SUPPORTING"].includes(flags.band)) throw Error("Invalid --band");
  if (!Number.isFinite(targetScore) || !Number.isFinite(importance) || !Number.isInteger(learningStage)) throw Error("Invalid numbers");
  if (!flags.reviewer || !flags.rationale) throw Error("Reviewer and rationale required");
  Object.assign(requirement,{
    targetScore,importance,importanceBand:flags.band,learningStage,
    rationale:flags.rationale,reviewer:flags.reviewer,
    reviewedAt:new Date().toISOString()
  });
  save();
}
