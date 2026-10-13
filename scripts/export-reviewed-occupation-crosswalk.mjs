#!/usr/bin/env node
/**
 * Read-only export of reviewer-approved source-to-canonical identifier links.
 * IMPORTANT: crosswalk approvals do not constitute validated role requirements.
 * Run after npm run build:core.
 */
import { readFileSync } from "node:fs";
import { getApprovedOccupationCrosswalk } from "../dist/lib/domain/occupation-mapping.js";
const load=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),"utf8"));
const result=getApprovedOccupationCrosswalk(
  load("../data/occupations/onet-online-curated-2026-10-13-v1.json"),
  load("../data/occupation-mappings/canonical-skill-snapshot-v1.json"),
  load("../data/occupation-mappings/review-decisions-v1.json")
);
process.stdout.write(JSON.stringify(result,null,2)+"\n");
