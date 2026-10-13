#!/usr/bin/env node
/**
 * Maintainer-only, repo-reviewed mapping decisions.
 * This CLI edits a versioned JSON ledger in the working tree. It does not
 * contact production, mutate Supabase, or generate assessed role models.
 *
 * Before use: npm run build:core
 * node scripts/occupation-mapping-review.mjs list
 * node scripts/occupation-mapping-review.mjs decide --key 'ESSENTIAL::active listening' --decision NEEDS_NEW_SKILL --reviewer @maintainer --reason 'There is no matching canonical competency in SkillTwin's current vocabulary.'
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildMappingReviewQueue,
  validateMappingReviewManifest
} from "../dist/lib/domain/occupation-mapping.js";

const base=process.cwd();
const files={
  source:resolve(base,"data/occupations/onet-online-curated-2026-10-13-v1.json"),
  catalog:resolve(base,"data/occupation-mappings/canonical-skill-snapshot-v1.json"),
  ledger:resolve(base,"data/occupation-mappings/review-decisions-v1.json")
};
const source=JSON.parse(readFileSync(files.source,"utf8"));
const catalog=JSON.parse(readFileSync(files.catalog,"utf8"));
const manifest=JSON.parse(readFileSync(files.ledger,"utf8"));
const parseFlags=args=>{
  const found={};
  for(let i=0;i<args.length;i+=2) {
    if(!args[i]?.startsWith("--")||args[i+1]===undefined)throw Error("Flags must use --name value");
    found[args[i].slice(2)]=args[i+1];
  }
  return found;
};
const cmd=process.argv[2]||"list", flags=parseFlags(process.argv.slice(3));
const allowed=new Set(["list","decide","validate"]);
if(!allowed.has(cmd))throw Error("Expected list, decide or validate");
const check=()=>{
  const errors=validateMappingReviewManifest(source,catalog,manifest);
  if(errors.length)throw Error(errors.join("\n"));
};
check();

if(cmd==="list") {
  const queue=buildMappingReviewQueue(source,catalog,manifest);
  const unresolved=queue.filter(item=>item.status==="PENDING");
  console.log(JSON.stringify({
    sourceSnapshotId:source.snapshotId,
    canonicalSnapshotId:catalog.snapshotId,
    sourceOccupations:source.occupations.length,
    uniqueSourceSkills:queue.length,
    approved:queue.filter(x=>x.status==="APPROVED").length,
    unresolved:unresolved.length,
    rejected:queue.filter(x=>x.status==="REJECTED").length,
    needsNewSkill:queue.filter(x=>x.status==="NEEDS_NEW_SKILL").length,
    queue:unresolved.map(item=>({
      key:item.sourceSkillKey,name:item.sourceName,
      mentionedBy:item.sourceOccupations.length,
      suggestions:item.suggestions
    }))
  },null,2));
}

if(cmd==="decide") {
  const key=String(flags.key??"");
  const decision=String(flags.decision??"");
  const reviewer=String(flags.reviewer??"");
  const reason=String(flags.reason??"").trim();
  const slug=flags.slug??null;
  const current=buildMappingReviewQueue(source,catalog,manifest).find(x=>x.sourceSkillKey===key);
  if(!current)throw Error("Unknown source skill key; run list first");
  if(current.review)throw Error("Existing review decision: update through a separate documented supersession PR");
  if(!["APPROVED","REJECTED","NEEDS_NEW_SKILL"].includes(decision))throw Error("Unsupported decision");
  if(decision==="APPROVED"&&!slug)throw Error("Approval requires --slug from the canonical catalog");
  if(decision!=="APPROVED"&&slug)throw Error("Only approval may include --slug");
  manifest.decisions.push({
    sourceSkillKey:key,decision,canonicalSkillSlug:slug,
    reviewer,reviewedAt:new Date().toISOString(),rationale:reason
  });
  const errors=validateMappingReviewManifest(source,catalog,manifest);
  if(errors.length)throw Error(errors.join("\n"));
  manifest.decisions.sort((a,b)=>a.sourceSkillKey.localeCompare(b.sourceSkillKey));
  writeFileSync(files.ledger,JSON.stringify(manifest,null,2)+"\n","utf8");
  console.log("Review written to "+files.ledger+" (local working tree only). Open a GitHub PR for human review.");
}

if(cmd==="validate") console.log("Mapping ledger schema and referential checks passed.");
