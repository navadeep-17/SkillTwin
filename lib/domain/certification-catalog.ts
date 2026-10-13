/** Reviewed issuer-owned certification links. An external catalog, not exam delivery.
 * Do not infer employer recognition, pass probability, eligibility, prices or
 * credential verification from these manually curated learning objectives.
 */
export type CertificationTrack="Cloud"|"Developer Tools"|"Cybersecurity"|"Networking"|"Data";
export type CertificationLevel="Foundational"|"Associate";
export type Certification={
  id:string;title:string;issuer:string;track:CertificationTrack;level:CertificationLevel;
  credentialType:"Official proctored exam";
  description:string;officialUrl:string;sourceReviewedOn:string;
  skills:string[];prerequisiteSkills:string[];
  roleKeywords:string[];topics:string[];
  note:string;
};

export const CERTIFICATION_CATALOG:readonly Certification[]=[
  {
    id:"aws-cloud-practitioner",title:"AWS Certified Cloud Practitioner",issuer:"Amazon Web Services",
    track:"Cloud",level:"Foundational",credentialType:"Official proctored exam",
    description:"An entry point for cloud concepts, AWS services, security and billing fundamentals.",
    officialUrl:"https://aws.amazon.com/certification/certified-cloud-practitioner/",
    sourceReviewedOn:"2026-10-13",
    skills:["cloud"],prerequisiteSkills:[],
    roleKeywords:["cloud","devops","platform engineer","site reliability","infrastructure","solutions architect"],
    topics:["Cloud fundamentals","AWS services","Cloud security and governance","Pricing and billing"],
    note:"A foundation credential is not proof of hands-on cloud engineering."
  },
  {
    id:"azure-fundamentals",title:"Microsoft Certified: Azure Fundamentals (AZ-900)",
    issuer:"Microsoft",track:"Cloud",level:"Foundational",credentialType:"Official proctored exam",
    description:"Foundational cloud concepts, Azure architecture, administration and governance.",
    officialUrl:"https://learn.microsoft.com/en-us/credentials/certifications/azure-fundamentals/",
    sourceReviewedOn:"2026-10-13",
    skills:["cloud"],prerequisiteSkills:[],
    roleKeywords:["cloud","devops","platform engineer","infrastructure","azure","systems administrator"],
    topics:["Cloud concepts","Azure architecture and services","Azure management and governance"],
    note:"Exam availability and regional pricing must be checked with Microsoft."
  },
  {
    id:"google-cloud-digital-leader",title:"Google Cloud Digital Leader",
    issuer:"Google Cloud",track:"Cloud",level:"Foundational",credentialType:"Official proctored exam",
    description:"Core Google Cloud capabilities, business use cases, operations and security concepts.",
    officialUrl:"https://cloud.google.com/learn/certification/cloud-digital-leader",
    sourceReviewedOn:"2026-10-13",
    skills:["cloud"],prerequisiteSkills:[],
    roleKeywords:["cloud","devops","platform engineer","product manager","digital transformation"],
    topics:["Cloud transformation","Google Cloud products","Data and AI applications","Cloud security"],
    note:"Broad cloud literacy; hands-on cloud roles may benefit more from applied projects."
  },
  {
    id:"aws-solutions-architect-associate",title:"AWS Certified Solutions Architect – Associate",
    issuer:"Amazon Web Services",track:"Cloud",level:"Associate",credentialType:"Official proctored exam",
    description:"Designing resilient, secure and cost-optimized AWS infrastructure.",
    officialUrl:"https://aws.amazon.com/certification/certified-solutions-architect-associate/",
    sourceReviewedOn:"2026-10-13",
    skills:["cloud","system-design"],prerequisiteSkills:["cloud"],
    roleKeywords:["cloud architect","solutions architect","cloud engineer","devops","platform engineer","infrastructure"],
    topics:["Secure architectures","Resilient systems","High-performing solutions","Cost optimization"],
    note:"Hands-on AWS experience is recommended; mapped SkillTwin skills do not measure AWS service mastery."
  },
  {
    id:"github-foundations",title:"GitHub Foundations",issuer:"GitHub",
    track:"Developer Tools",level:"Foundational",credentialType:"Official proctored exam",
    description:"GitHub collaboration, repositories, workflows, contributions and platform fundamentals.",
    officialUrl:"https://learn.github.com/credentials",sourceReviewedOn:"2026-10-13",
    skills:["git"],prerequisiteSkills:[],
    roleKeywords:["software","developer","full stack","frontend","backend","devops","platform engineer","quality engineer"],
    topics:["Git and GitHub workflows","Repository collaboration","Contributions and pull requests"],
    note:"A GitHub knowledge exam complements, rather than replaces, a working public project."
  },
  {
    id:"github-actions",title:"GitHub Actions Certification",issuer:"GitHub",
    track:"Developer Tools",level:"Associate",credentialType:"Official proctored exam",
    description:"Intermediate knowledge of workflow automation, CI/CD and GitHub Actions.",
    officialUrl:"https://learn.github.com/certification/ACTIONS",sourceReviewedOn:"2026-10-13",
    skills:["git","testing"],prerequisiteSkills:["git"],
    roleKeywords:["devops","platform engineer","software engineer","software developer","site reliability"],
    topics:["Workflows and triggers","Automation and CI/CD","Security and maintenance"],
    note:"Practical GitHub Actions experience remains important; a Git skill match is not CI/CD exam readiness."
  },
  {
    id:"isc2-cc",title:"ISC2 Certified in Cybersecurity (CC)",issuer:"ISC2",
    track:"Cybersecurity",level:"Foundational",credentialType:"Official proctored exam",
    description:"Entry-level security principles, identity and access, network security, and operations.",
    officialUrl:"https://www.isc2.org/certifications/cc",sourceReviewedOn:"2026-10-13",
    skills:["authentication","cloud","linux"],prerequisiteSkills:[],
    roleKeywords:["cybersecurity","security analyst","soc analyst","it support","information security","network security"],
    topics:["Security principles","Identity and access","Networking and cloud security","Incident response"],
    note:"Only approximate matches to SkillTwin's current skill taxonomy; security coverage is incomplete."
  },
  {
    id:"cisco-ccna",title:"Cisco Certified Network Associate (CCNA)",issuer:"Cisco",
    track:"Networking",level:"Associate",credentialType:"Official proctored exam",
    description:"Networking fundamentals, IP connectivity, routing, security and automation.",
    officialUrl:"https://www.cisco.com/site/us/en/learn/training-certifications/exams/ccna.html",
    sourceReviewedOn:"2026-10-13",
    skills:["linux","cloud"],prerequisiteSkills:[],
    roleKeywords:["network engineer","network administrator","network technician","network security","infrastructure"],
    topics:["Network fundamentals","Network access and IP services","Security fundamentals","Automation"],
    note:"SkillTwin does not yet model CCNA-specific networking skills; recommendations are approximate."
  },
  {
    id:"power-bi-data-analyst",title:"Microsoft Certified: Power BI Data Analyst Associate",
    issuer:"Microsoft",track:"Data",level:"Associate",credentialType:"Official proctored exam",
    description:"Preparing, modelling and analysing data with Power BI, including visualization and governance.",
    officialUrl:"https://learn.microsoft.com/en-us/credentials/certifications/data-analyst-associate/",
    sourceReviewedOn:"2026-10-13",
    skills:["power-bi","data-visualization","excel","sql"],prerequisiteSkills:["power-bi"],
    roleKeywords:["data analyst","business intelligence","bi analyst","business analyst","analytics engineer"],
    topics:["Prepare data","Model data","Visualise and analyse","Manage and secure Power BI"],
    note:"Power Query and DAX skills are assessed by the issuer but not modeled separately by SkillTwin."
  },
  {
    id:"databricks-data-engineer-associate",title:"Databricks Certified Data Engineer Associate",
    issuer:"Databricks",track:"Data",level:"Associate",credentialType:"Official proctored exam",
    description:"Databricks data ingestion, transformation, platform operations and CI/CD basics.",
    officialUrl:"https://www.databricks.com/learn/certification/data-engineer-associate",
    sourceReviewedOn:"2026-10-13",
    skills:["python","sql","pandas"],prerequisiteSkills:["python","sql"],
    roleKeywords:["data engineer","analytics engineer","data platform","data infrastructure"],
    topics:["Data ingestion","Data transformations","ETL pipelines","Governance and operations"],
    note:"Databricks-specific PySpark and platform expertise are not represented by these general skill matches."
  }
] as const;

export function certificationById(id:string):Certification|undefined {
  return CERTIFICATION_CATALOG.find(item=>item.id===id);
}
