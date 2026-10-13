import {
  CERTIFICATION_CATALOG, type Certification, type CertificationTrack
} from "./certification-catalog.js";

export type LearnerSkillSignal={
  slug:string;level:string|null;confidence:number|null;evidenceCount:number;
};
export type LearnerGapSignal={
  slug:string;status:string|null;priorityBand:string|null;severity:number|null;
};
export type CertificationLearnerContext={
  goalName:string|null;skills:LearnerSkillSignal[];gaps:LearnerGapSignal[];
};
export type CertificationMatch={
  certification:Certification;
  alignment:"ROLE_AND_GAP"|"GOAL_MATCH"|"GAP_MATCH"|"EXPLORE";
  sortScore:number|null;
  reasons:string[];
  matchedGapSlugs:string[];
  knownSkillSlugs:string[];
  missingPrerequisiteSlugs:string[];
  preparation:"FOUNDATION_FIRST"|"CHECK_ISSUER_SYLLABUS"|"NO_ASSESSMENT_EVIDENCE";
};
const norm=(s:string)=>s.toLowerCase().replace(/\s+/g," ").trim();
const safe=(x:number|null)=>x!=null&&Number.isFinite(x)?x:null;
const levelKnown=(l:string|null)=>Boolean(l && l.toUpperCase()!=="UNKNOWN");
const isActionableGap=(g:LearnerGapSignal)=>(
  ["GAP","DEVELOPING"].includes(String(g.status??"").toUpperCase())
  && (Boolean(g.priorityBand)||safe(g.severity)!=null&&(g.severity as number)>0.03)
);
const priority=(s:string|null)=>({CRITICAL:4,HIGH:3,MEDIUM:2,LOW:1}[String(s??"").toUpperCase()]??0);

export function rankCertifications(
  context:CertificationLearnerContext,
  catalog:readonly Certification[]=CERTIFICATION_CATALOG
):CertificationMatch[] {
  const role=norm(context.goalName??"");
  const bySkill=new Map(context.skills.map(s=>[s.slug,s]));
  const gaps=new Map(context.gaps.filter(isActionableGap).map(g=>[g.slug,g]));
  const hasGoal=Boolean(role);
  return catalog.map(certification=>{
    const roleMatch=hasGoal&&certification.roleKeywords.some(keyword=>role.includes(norm(keyword)));
    const matchedGaps=certification.skills.filter(slug=>gaps.has(slug));
    const known=certification.skills.filter(slug=>{
      const s=bySkill.get(slug);
      return Boolean(s&&levelKnown(s.level)&&s.evidenceCount>0);
    });
    const missing=certification.prerequisiteSkills.filter(slug=>{
      const s=bySkill.get(slug);
      return !s||!levelKnown(s.level)||s.evidenceCount<=0;
    });
    const aligned=roleMatch&&matchedGaps.length>0?"ROLE_AND_GAP"
      :roleMatch?"GOAL_MATCH":matchedGaps.length>0?"GAP_MATCH":"EXPLORE";
    const gapPriority=matchedGaps.reduce((total,slug)=>total+Math.max(1,priority(gaps.get(slug)?.priorityBand??null)),0);
    const sortScore=hasGoal
      ?Math.round((roleMatch?50:0)+Math.min(32,gapPriority*7)+
        (certification.level==="Foundational"?5:0)-
        (certification.level!=="Foundational"&&missing.length?12:0))
      :null;
    const reasons:string[]=[];
    if(roleMatch)reasons.push("Related to your "+context.goalName+" goal.");
    if(matchedGaps.length)reasons.push("Touches your recorded gaps: "+matchedGaps.join(", ")+".");
    if(!roleMatch&&!matchedGaps.length)reasons.push(
      hasGoal?"No strong connection to your current goal or recorded priority gaps.":"Choose a career goal to personalize this catalog."
    );
    if(missing.length)reasons.push(
      "Build prerequisite evidence first: "+missing.join(", ")+"."
    );
    if(!certification.prerequisiteSkills.length)reasons.push(
      "No prerequisites are mapped in this catalog; review the official issuer requirements."
    );
    const preparation=missing.length?"FOUNDATION_FIRST"
      :known.length>0?"CHECK_ISSUER_SYLLABUS":"NO_ASSESSMENT_EVIDENCE";
    return {
      certification,alignment:aligned,sortScore,reasons,
      matchedGapSlugs:matchedGaps,knownSkillSlugs:known,
      missingPrerequisiteSlugs:missing,preparation
    };
  }).sort((a,b)=>{
    const rank={ROLE_AND_GAP:0,GOAL_MATCH:1,GAP_MATCH:2,EXPLORE:3};
    return rank[a.alignment]-rank[b.alignment]
      ||(b.sortScore??0)-(a.sortScore??0)
      ||(a.certification.level===b.certification.level?0:a.certification.level==="Foundational"?-1:1)
      ||a.certification.title.localeCompare(b.certification.title);
  });
}

export function getCatalogTracks(
  catalog:readonly Certification[]=CERTIFICATION_CATALOG
):CertificationTrack[] {
  return [...new Set(catalog.map(c=>c.track))];
}
