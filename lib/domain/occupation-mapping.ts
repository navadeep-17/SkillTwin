export type CanonicalSkill = {
  slug: string;
  name: string;
  category: string;
  taxonomyVersion: number;
};
export type CanonicalSnapshot = {
  snapshotId: string;
  skills: CanonicalSkill[];
};
export type SourceSkill = {
  name: string;
  importance: number;
  sourceOrder: number;
  mappingStatus: string;
};
export type SourceOccupation = {
  occupationId: string;
  name: string;
  sourceUrl: string;
  essentialSkills: SourceSkill[];
  transferableSkills: SourceSkill[];
};
export type SourceSnapshot = {
  snapshotId: string;
  occupations: SourceOccupation[];
};
export type MappingDecision = {
  sourceSkillKey: string;
  decision: "APPROVED" | "REJECTED" | "NEEDS_NEW_SKILL";
  canonicalSkillSlug: string | null;
  reviewer: string;
  reviewedAt: string;
  rationale: string;
};
export type MappingReviewManifest = {
  schemaVersion: number;
  sourceSnapshotId: string;
  canonicalSnapshotId: string;
  decisions: MappingDecision[];
};
export type SourceSkillReviewItem = {
  sourceSkillKey: string;
  sourceName: string;
  sourceGroup: "ESSENTIAL" | "TRANSFERABLE";
  sourceOccupations: { occupationId: string; name: string; url: string; importance: number }[];
  suggestions: { slug: string; name: string; similarity: number; method: string }[];
  review: MappingDecision | null;
  status: "PENDING" | MappingDecision["decision"];
};

export function normalizeSkillName(input: string): string {
  return input.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
}
export function reviewKey(name: string, group: "ESSENTIAL" | "TRANSFERABLE") {
  return group + "::" + normalizeSkillName(name);
}
function tokens(s: string): Set<string> {
  return new Set(normalizeSkillName(s).split(" ").filter(x => x.length > 2 && !["and","the","for","with","skill","skills"].includes(x)));
}
function lexicalSimilarity(a: string, b: string): number {
  if (normalizeSkillName(a) === normalizeSkillName(b)) return 1;
  const left=tokens(a),right=tokens(b);
  const overlap=[...left].filter(x=>right.has(x)).length;
  const union=new Set([...left,...right]).size;
  return union ? overlap/union : 0;
}
/**
 * A proposal is never an approved mapping. Substring and generic-word matches
 * are deliberately excluded to avoid misleading occupation crosswalks.
 */
export function suggestCanonicalSkills(name: string, catalog: CanonicalSkill[]) {
  return catalog.map(s => {
    const score = lexicalSimilarity(name,s.name);
    return {
      slug: s.slug,
      name: s.name,
      similarity: score,
      method: score === 1 ? "EXACT_LABEL" : "TOKEN_OVERLAP"
    };
  }).filter(x => x.similarity >= 0.6).sort((a,b)=>b.similarity-a.similarity||a.slug.localeCompare(b.slug)).slice(0,3);
}
export function buildMappingReviewQueue(
  source: SourceSnapshot,
  catalog: CanonicalSnapshot,
  manifest: MappingReviewManifest
): SourceSkillReviewItem[] {
  const map=new Map<string,SourceSkillReviewItem>();
  for(const occupation of source.occupations) {
    for(const [group,items] of [
      ["ESSENTIAL",occupation.essentialSkills],
      ["TRANSFERABLE",occupation.transferableSkills]
    ] as const) {
      for(const skill of items) {
        const key=reviewKey(skill.name,group);
        let item=map.get(key);
        if(!item) {
          item={
            sourceSkillKey:key,sourceName:skill.name,sourceGroup:group,
            sourceOccupations:[],
            suggestions:suggestCanonicalSkills(skill.name,catalog.skills),
            review:null,status:"PENDING"
          };
          map.set(key,item);
        }
        item.sourceOccupations.push({
          occupationId:occupation.occupationId,name:occupation.name,
          url:occupation.sourceUrl,importance:skill.importance
        });
      }
    }
  }
  const decisions=new Map(manifest.decisions.map(d=>[d.sourceSkillKey,d]));
  for(const item of map.values()) {
    item.review=decisions.get(item.sourceSkillKey)??null;
    item.status=item.review?.decision??"PENDING";
  }
  return [...map.values()].sort((a,b)=>a.sourceGroup.localeCompare(b.sourceGroup)||a.sourceName.localeCompare(b.sourceName));
}
export function validateMappingReviewManifest(
  source: SourceSnapshot,
  catalog: CanonicalSnapshot,
  manifest: MappingReviewManifest
): string[] {
  const errors:string[]=[];
  if(manifest.schemaVersion!==1)errors.push("Unsupported mapping review schema");
  if(manifest.sourceSnapshotId!==source.snapshotId)errors.push("Source snapshot version mismatch");
  if(manifest.canonicalSnapshotId!==catalog.snapshotId)errors.push("Canonical snapshot version mismatch");
  if(!Array.isArray(manifest.decisions))return [...errors,"Decisions must be an array"];
  const queue=buildMappingReviewQueue(source,catalog,{...manifest,decisions:[]});
  const permitted=new Set(queue.map(x=>x.sourceSkillKey));
  const slugs=new Set(catalog.skills.map(x=>x.slug));
  const visited=new Set<string>();
  for(const row of manifest.decisions) {
    const key=row.sourceSkillKey;
    if(!permitted.has(key))errors.push("Unrecognized source skill key: "+key);
    if(visited.has(key))errors.push("Duplicate review decision: "+key);
    visited.add(key);
    if(!["APPROVED","REJECTED","NEEDS_NEW_SKILL"].includes(row.decision))errors.push("Unknown decision: "+key);
    if(row.decision==="APPROVED"&&(!row.canonicalSkillSlug||!slugs.has(row.canonicalSkillSlug))) {
      errors.push("Approval requires an existing canonical slug: "+key);
    }
    if(row.decision!=="APPROVED"&&row.canonicalSkillSlug!==null) {
      errors.push("Non-approval cannot carry canonical slug: "+key);
    }
    if(typeof row.reviewer!=="string"||!/^@[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$/.test(row.reviewer)) {
      errors.push("Missing reviewer GitHub handle: "+key);
    }
    if(typeof row.rationale!=="string"||row.rationale.trim().length<20||row.rationale.length>800) {
      errors.push("Decision requires 20–800 characters of rationale: "+key);
    }
    if(typeof row.reviewedAt!=="string"||Number.isNaN(Date.parse(row.reviewedAt))||!row.reviewedAt.endsWith("Z")) {
      errors.push("Decision requires an ISO UTC review time: "+key);
    }
  }
  return errors;
}
