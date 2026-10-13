import {
  CERTIFICATION_CATALOG, certificationById, type Certification
} from "./certification-catalog.js";
import {progressPercent,type CertificationJourney} from "./certification-journey.js";
import type {CertificationMatch} from "./certification-recommender.js";

export type OfficialStudyResource={
  kind:"EXAM_GUIDE"|"TRAINING"|"PRACTICE";
  title:string;url:string;issuer:string;access:"Issuer page — check pricing"|"Official online learning";
  reviewedOn:string;
};
export type PreparationStep={
  id:string;phase:"PREREQUISITES"|"LEARN"|"PRACTICE"|"REVIEW";
  title:string;details:string;
  completed:boolean;
  resource:OfficialStudyResource;
};
/** Explicit issuer-owned resources, not inferred from open-web search snippets. */
const officialResources:Readonly<Record<string,readonly Omit<OfficialStudyResource,"issuer"|"reviewedOn">[]>>={
  "aws-cloud-practitioner":[
    {kind:"EXAM_GUIDE",title:"AWS Cloud Practitioner certification and preparation",url:"https://aws.amazon.com/certification/certified-cloud-practitioner/",access:"Issuer page — check pricing"}
  ],
  "azure-fundamentals":[
    {kind:"EXAM_GUIDE",title:"Official AZ-900 skills measured and preparation",url:"https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/az-900",access:"Official online learning"}
  ],
  "google-cloud-digital-leader":[
    {kind:"TRAINING",title:"Google Cloud Digital Leader learning path and sample questions",url:"https://cloud.google.com/learn/certification/cloud-digital-leader",access:"Issuer page — check pricing"}
  ],
  "aws-solutions-architect-associate":[
    {kind:"EXAM_GUIDE",title:"AWS Solutions Architect – Associate exam guide and preparation",url:"https://aws.amazon.com/certification/certified-solutions-architect-associate/",access:"Issuer page — check pricing"}
  ],
  "github-foundations":[
    {kind:"TRAINING",title:"GitHub Foundations official learning path",url:"https://learn.microsoft.com/en-us/training/paths/github-foundations/",access:"Official online learning"},
    {kind:"PRACTICE",title:"GitHub Foundations official practice assessment",url:"https://learn.microsoft.com/en-us/credentials/certifications/github-foundations/",access:"Official online learning"}
  ],
  "github-actions":[
    {kind:"EXAM_GUIDE",title:"GitHub Actions certification learning path and practice",url:"https://learn.github.com/certification/ACTIONS",access:"Issuer page — check pricing"}
  ],
  "isc2-cc":[
    {kind:"TRAINING",title:"ISC2 CC official self-study resources and flash cards",url:"https://www.isc2.org/certifications/cc/cc-self-study-resources",access:"Issuer page — check pricing"}
  ],
  "cisco-ccna":[
    {kind:"TRAINING",title:"Cisco CCNA official guided training and practice",url:"https://www.cisco.com/site/us/en/learn/training-certifications/training/courses/ccna.html",access:"Issuer page — check pricing"}
  ],
  "power-bi-data-analyst":[
    {kind:"EXAM_GUIDE",title:"Microsoft PL-300 exam objectives and learning resources",url:"https://learn.microsoft.com/en-us/certifications/resources/study-guides/PL-300",access:"Official online learning"}
  ],
  "databricks-data-engineer-associate":[
    {kind:"EXAM_GUIDE",title:"Databricks Data Engineer Associate exam guide",url:"https://www.databricks.com/learn/certification/data-engineer-associate",access:"Issuer page — check pricing"}
  ]
};

export function getOfficialStudyResources(certificationId:string):OfficialStudyResource[]{
  const certification=certificationById(certificationId);
  if(!certification)return [];
  return (officialResources[certificationId]??[{
    kind:"EXAM_GUIDE" as const,title:"Official certification guide",
    url:certification.officialUrl,access:"Issuer page — check pricing" as const
  }]).map(resource=>({...resource,issuer:certification.issuer,reviewedOn:"2026-10-13"}));
}

export type PreparationPlan={
  certificationId:string;
  certificationTitle:string;
  studyCoveragePercent:number;
  readinessLabel:"NOT_ASSESSED";
  steps:PreparationStep[];
  nextStep:PreparationStep|null;
  completedSteps:number;
  totalSteps:number;
  guidance:string[];
  resources:OfficialStudyResource[];
};
/** Deterministic guidance from saved milestone flags + existing gap priorities.
 * Milestones are learner claims; not external learning-platform completion.
 */
export function buildCertificationPreparationPlan(
  journey:Pick<CertificationJourney,"certification_id"|"completed_topics"|"status">,
  match?:CertificationMatch|null
):PreparationPlan|null {
  const certification=certificationById(journey.certification_id);
  if(!certification)return null;
  const resources=getOfficialStudyResources(certification.id);
  const primary=resources[0];
  const studyResource=resources.find(r=>r.kind==="TRAINING")??primary;
  const practiceResource=resources.find(r=>r.kind==="PRACTICE")??primary;
  const done=new Set(Array.isArray(journey.completed_topics)?journey.completed_topics:[]);
  const prerequisites=match?.missingPrerequisiteSlugs??[];
  const steps:PreparationStep[]=[
    ...prerequisites.map((slug):PreparationStep=>({
      id:"prerequisite:"+slug,phase:"PREREQUISITES",
      title:"Strengthen "+slug.replaceAll("-"," "),
      details:"Prerequisite evidence is missing in SkillTwin. Review the issuer's full prerequisites before starting advanced topics.",
      completed:false,resource:primary
    })),
    ...certification.topics.map((topic,i):PreparationStep=>({
      id:"topic:"+i,phase:"LEARN",title:topic,
      details:"Study the issuer objectives and practise this topic. Checklist completion is self-reported.",
      completed:done.has(topic),resource:studyResource
    })),
    {
      id:"official-practice",phase:"PRACTICE",
      title:"Use issuer practice or sample questions",
      details:"Locate official practice materials if available. Practice results are not recorded or verified by SkillTwin.",
      completed:false,resource:practiceResource
    },
    {
      id:"final-check",phase:"REVIEW",
      title:"Review the current exam guide and booking requirements",
      details:"Check exact exam objectives, regional fees, exam availability and any eligibility rules directly with the issuer.",
      completed:false,resource:primary
    }
  ];
  const guidance:string[]=[
    "Career relevance does not establish exam readiness. SkillTwin has not administered an issuer exam.",
    "This plan is a suggested order, not a guaranteed timeline or paid training enrollment."
  ];
  if(prerequisites.length)guidance.unshift(
    "Build foundational evidence first: "+prerequisites.map(slug=>slug.replaceAll("-"," ")).join(", ")+"."
  );
  if(journey.status==="EARNED_SELF_REPORTED")
    guidance.unshift("The earned credential was self-reported; issuer verification is still required.");
  return {
    certificationId:certification.id,certificationTitle:certification.title,
    studyCoveragePercent:progressPercent(journey),
    readinessLabel:"NOT_ASSESSED",
    steps,nextStep:steps.find(s=>!s.completed)??null,
    completedSteps:steps.filter(s=>s.completed).length,totalSteps:steps.length,
    guidance,resources
  };
}

export function certificationResourceCoverage(
  catalog:readonly Certification[]=CERTIFICATION_CATALOG
):boolean {
  return catalog.every(c=>getOfficialStudyResources(c.id).length>0
    && getOfficialStudyResources(c.id).every(r=>
      r.url.startsWith("https://")&&r.reviewedOn.length>0&&r.issuer===c.issuer));
}
