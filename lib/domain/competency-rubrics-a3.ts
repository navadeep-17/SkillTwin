/**
 * Internal competency rubric pilot. All thresholds and descriptions are
 * SkillTwin-authored DRAFTS, not certified industry standards or IRT items.
 * An assessor must independently map a concrete observed task to an ID.
 */
export const COMPETENCY_RUBRIC_VERSION = "competency-rubrics-a3-draft1";
export type CompetencyTier = 1 | 2 | 3 | 4;

export interface CompetencyCriterion {
  readonly id: string;
  readonly tier: CompetencyTier;
  readonly description: string;
}
export interface SkillCompetencyRubric {
  readonly skillSlug: string;
  readonly displayName: string;
  readonly version: typeof COMPETENCY_RUBRIC_VERSION;
  readonly criteria: readonly CompetencyCriterion[];
}

function makeRubric(slug: string, displayName: string,
  criteria: readonly [string, CompetencyTier, string][]): SkillCompetencyRubric {
  return Object.freeze({
    skillSlug: slug,
    displayName,
    version: COMPETENCY_RUBRIC_VERSION,
    criteria: Object.freeze(criteria.map(([id,tier,description]) =>
      Object.freeze({id: slug + "." + id, tier, description})))
  });
}

const rubrics: readonly SkillCompetencyRubric[] = Object.freeze([
  makeRubric("python","Python",[
    ["basic-types",1,"Write basic expressions using Python types and control flow"],
    ["functions",1,"Write and call functions with arguments and return values"],
    ["collections",2,"Choose and transform lists, sets, and dictionaries correctly"],
    ["testing-errors",2,"Write tests and handle expected exceptions"],
    ["architecture",3,"Organize and maintain a multi-module application"],
    ["profiling",3,"Measure and improve performance using evidence"],
    ["production-tradeoffs",4,"Lead production Python architecture with documented tradeoffs"]
  ]),
  makeRubric("sql","SQL",[
    ["select-filter",1,"Query and filter relational tables"],
    ["join",1,"Use appropriate joins without unintended duplication"],
    ["aggregation",2,"Write grouped aggregations and subqueries"],
    ["transactions",2,"Use transactions and database constraints correctly"],
    ["query-plans",3,"Interpret execution plans and optimize indexed access"],
    ["concurrency",3,"Reason about isolation levels and concurrency anomalies"],
    ["production-architecture",4,"Design resilient database architecture and migration strategies"]
  ]),
  makeRubric("rest-api","REST APIs",[
    ["http-semantics",1,"Use HTTP methods and status codes appropriately"],
    ["resource-routing",1,"Implement basic resource-oriented endpoints"],
    ["validation-errors",2,"Validate input and return meaningful failure responses"],
    ["authentication",2,"Enforce identity and authorization at endpoints"],
    ["idempotency",3,"Design retry-safe APIs and idempotency semantics"],
    ["versioning-observability",3,"Handle versioning and monitor endpoint reliability"],
    ["production-evolution",4,"Lead a complex API evolution with documented production evidence"]
  ]),
  makeRubric("authentication","Authentication",[
    ["identity",1,"Explain identity, authentication and authorization distinctions"],
    ["session-basics",1,"Implement basic sessions or tokens correctly"],
    ["secure-storage",2,"Handle password hashing and secret storage safely"],
    ["authorization",2,"Enforce server-side permissions on protected resources"],
    ["token-lifecycle",3,"Handle token expiry, rotation, revocation and abuse paths"],
    ["threat-model",3,"Threat-model credential, session and privilege attacks"],
    ["production-security",4,"Lead review and incident-driven hardening of production authentication"]
  ]),
  makeRubric("git","Git",[
    ["commit-history",1,"Create commits and explain repository history"],
    ["branches",1,"Create and switch branches safely"],
    ["conflicts",2,"Resolve merge conflicts without losing work"],
    ["collaboration",2,"Use pull requests and code review responsibly"],
    ["recovery",3,"Recover from complex history errors with reflog or safe restore"],
    ["release-workflow",3,"Design branch and release workflows for a team"],
    ["organization-governance",4,"Govern large multi-team version-control workflows"]
  ]),
  makeRubric("docker","Docker",[
    ["build-run",1,"Build an image and run a container"],
    ["logs-volumes",1,"Inspect logs and explain container storage"],
    ["networking",2,"Configure service networking and environment settings"],
    ["multi-stage",2,"Build reproducible multi-stage images without embedding secrets"],
    ["runtime-security",3,"Apply practical image and runtime security controls"],
    ["release-ops",3,"Debug and improve deployment reliability and resource usage"],
    ["production-platform",4,"Lead secure production container-platform practices"]
  ])
]);

const catalog = new Map(rubrics.map(r => [r.skillSlug,r]));
export function getCompetencyRubric(skillSlug: string): SkillCompetencyRubric | null {
  return catalog.get(skillSlug) ?? null;
}
export function listCompetencyRubrics(): readonly SkillCompetencyRubric[] {
  return rubrics;
}
