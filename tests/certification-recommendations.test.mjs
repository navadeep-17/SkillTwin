import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {CERTIFICATION_CATALOG,certificationById} from "../dist/lib/domain/certification-catalog.js";
import {rankCertifications,getCatalogTracks} from "../dist/lib/domain/certification-recommender.js";

const gap=(slug,status="GAP",priorityBand="HIGH")=>({slug,status,priorityBand,severity:0.6});
const skill=(slug,level="INTERMEDIATE",count=2)=>({slug,level,confidence:0.6,evidenceCount:count});
const context=(goalName,skills=[],gaps=[])=>({goalName,skills,gaps});

test("catalog uses unique reviewed official issuer destinations, never invented exam delivery",()=>{
  assert.equal(CERTIFICATION_CATALOG.length,10);
  assert.equal(new Set(CERTIFICATION_CATALOG.map(c=>c.id)).size,10);
  assert.ok(getCatalogTracks().length>=5);
  for(const c of CERTIFICATION_CATALOG){
    assert.equal(c.credentialType,"Official proctored exam");
    assert.match(c.sourceReviewedOn,/^2026-10-13$/);
    assert.ok(c.topics.length>=3,c.id);
    assert.ok(c.skills.length>=1,c.id);
    assert.ok(c.roleKeywords.length>=1,c.id);
    const url=new URL(c.officialUrl);
    assert.equal(url.protocol,"https:");
    assert.ok(["amazonaws.com","aws.amazon.com","learn.microsoft.com","learn.github.com",
      "www.isc2.org","www.cisco.com","cloud.google.com","www.databricks.com"]
      .some(domain=>url.hostname===domain),c.id+" not an issuer-owned URL");
    assert.equal(certificationById(c.id),c);
  }
  assert.equal(certificationById("does-not-exist"),undefined);
});

test("role and actionable gap jointly drive a justified shortlist",()=>{
  const ranked=rankCertifications(context("Software Engineer",[skill("git")],[gap("git")]));
  const foundations=ranked.find(r=>r.certification.id==="github-foundations");
  const cloud=ranked.find(r=>r.certification.id==="azure-fundamentals");
  assert.equal(foundations?.alignment,"ROLE_AND_GAP");
  assert.deepEqual(foundations?.matchedGapSlugs,["git"]);
  assert.equal(cloud?.alignment,"EXPLORE");
  assert.ok(ranked.indexOf(foundations)<ranked.indexOf(cloud));
  assert.ok(foundations?.reasons.some(reason=>/your recorded gaps/.test(reason)));
});

test("missing evidence or mismatched goals must not create false exam-ready claims",()=>{
  const ranked=rankCertifications(context("Cloud Engineer",[],[gap("cloud")]));
  const advanced=ranked.find(r=>r.certification.id==="aws-solutions-architect-associate");
  const foundation=ranked.find(r=>r.certification.id==="aws-cloud-practitioner");
  assert.equal(advanced?.preparation,"FOUNDATION_FIRST");
  assert.deepEqual(advanced?.missingPrerequisiteSlugs,["cloud"]);
  assert.equal(foundation?.alignment,"ROLE_AND_GAP");
  assert.ok((foundation?.sortScore??0)>(advanced?.sortScore??0));
  assert.equal(foundation?.preparation,"NO_ASSESSMENT_EVIDENCE");
  assert.deepEqual(foundation?.knownSkillSlugs,[]);
});

test("met or unknown gaps are excluded even if previously high priority",()=>{
  const ranked=rankCertifications(context("Software Engineer",[],[
    gap("git","MET","HIGH"),gap("testing","UNKNOWN","CRITICAL")
  ]));
  const github=ranked.find(r=>r.certification.id==="github-foundations");
  assert.equal(github?.alignment,"GOAL_MATCH");
  assert.deepEqual(github?.matchedGapSlugs,[]);
});

test("unconfigured learner gets exploration, never a fabricated role fit",()=>{
  const ranked=rankCertifications(context(null));
  assert.equal(ranked.length,CERTIFICATION_CATALOG.length);
  assert.ok(ranked.every(r=>r.alignment==="EXPLORE"&&r.sortScore===null));
  assert.ok(ranked.every(r=>r.reasons.some(reason=>/Choose a career goal/.test(reason))));
  assert.deepEqual(ranked,rankCertifications(context(null)));
});

test("recommendations use owner-scoped read-only inputs and link out to issuers",()=>{
  const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
  const service=read("lib/services/certifications/certification-service.ts");
  const api=read("app/api/certifications/route.ts");
  const page=read("app/certifications/page.tsx");
  const ui=read("components/certifications/certification-explorer.tsx");
  const nav=read("components/shell/app-nav-links.tsx");
  const middleware=read("middleware.ts");
  assert.match(service,/\.eq\("user_id",userId\)/);
  assert.match(service,/\.eq\("goal_id",goal\.id\)/);
  assert.match(service,/\.select\("skill_id,status,priority_band,gap_severity/);
  assert.match(api,/requireUser\(\)/);
  assert.match(api,/getCertificationRecommendations\(supabase,user\.id\)/);
  assert.match(page,/redirect\("\/login"\)/);
  assert.match(ui,/target="_blank" rel="noopener noreferrer"/);
  assert.match(ui,/Official exam and preparation/);
  assert.match(ui,/No evidence-backed shortlist yet/);
  assert.match(nav, /href: "\/certifications"/);
  assert.match(middleware, /"\\/certifications"/);
  assert.doesNotMatch(api,/export async function POST|insert\s+into|update public/i);
});
