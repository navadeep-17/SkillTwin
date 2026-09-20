import "server-only";
import { z } from "zod";
import { getSql } from "@/lib/db/postgres";
import { getGeminiStructuredClient } from "@/lib/ai/gemini-interactions";

export const PROJECT_RECOMMENDER_VERSION = "project-recommender-d1";

type Row = Record<string, unknown>;
const rows = (value: unknown) => value as Row[];

const recommendationSchema = z.object({
  title: z.string().trim().min(4).max(120),
  summary: z.string().trim().min(20).max(700),
  skillSlugs: z.array(z.string().trim().min(1)).min(1).max(5),
  technologies: z.array(z.string().trim().min(1).max(60)).min(1).max(10),
  requirements: z.array(z.string().trim().min(3).max(220)).min(3).max(8),
  milestones: z.array(z.string().trim().min(3).max(220)).min(3).max(8),
  successCriteria: z.array(z.string().trim().min(3).max(220)).min(2).max(8),
  estimatedMinutes: z.number().int().min(120).max(2400),
  difficulty: z.enum(["BASIC","STANDARD","ADVANCED"]),
  rationale: z.string().trim().min(10).max(500)
});

const responseSchema = z.object({
  recommendations: z.array(recommendationSchema).min(2).max(3)
});

function parseJson(value: unknown): unknown {
  let current = value;
  for (let depth = 0; depth < 2 && typeof current === "string"; depth += 1) {
    try {
      current = JSON.parse(current);
    } catch {
      break;
    }
  }
  return current;
}

function stringArray(value: unknown): string[] {
  const parsed = parseJson(value);
  return Array.isArray(parsed) ? parsed.map(String) : [];
}

function fallbackRecommendations(roleName: string, gaps: Row[]) {
  const primary = gaps.slice(0, 4);
  const names = primary.map(gap => String(gap.canonical_name));
  const slugs = primary.map(gap => String(gap.slug));
  const titleStem = roleName.replace(/s+/g, " ").trim();

  return [
    {
      title: titleStem + " core workflow build",
      summary: "Build a focused end-to-end project that forces you to apply the highest-priority missing skills in one working workflow.",
      skillSlugs: slugs.slice(0, 2),
      technologies: names.slice(0, 2),
      requirements: [
        "Implement one complete user-facing workflow.",
        "Use the target skills in working code rather than only configuration or notes.",
        "Document architecture decisions and the tradeoffs you made.",
        "Include a repeatable setup and verification path."
      ],
      milestones: [
        "Define the smallest useful workflow and acceptance criteria.",
        "Implement the core path with the first priority skill.",
        "Integrate the second priority skill and handle failure cases.",
        "Document and demo the finished workflow."
      ],
      successCriteria: [
        "The workflow runs end to end from a clean setup.",
        "The repository contains evidence of each targeted skill in use.",
        "The README explains how the implementation demonstrates the selected competencies."
      ],
      estimatedMinutes: 360,
      difficulty: "STANDARD" as const,
      rationale: "Targets the two highest-priority role gaps with direct project evidence."
    },
    {
      title: titleStem + " reliability and validation project",
      summary: "Extend a small application with testing, observability, validation, or deployment work so SkillTwin can collect stronger evidence than a simple skill mention.",
      skillSlugs: slugs.slice(0, 3),
      technologies: names.slice(0, 3),
      requirements: [
        "Start from a minimal working application or service.",
        "Add measurable validation for the targeted capabilities.",
        "Handle at least two realistic failure paths.",
        "Capture evidence in code, tests, and documentation."
      ],
      milestones: [
        "Create the baseline application.",
        "Add the highest-priority competency.",
        "Add validation and failure handling.",
        "Run the validation checklist and record results."
      ],
      successCriteria: [
        "The project includes automated or reproducible validation.",
        "Failure behavior is intentional and documented.",
        "At least two current gap skills are demonstrably exercised."
      ],
      estimatedMinutes: 480,
      difficulty: "STANDARD" as const,
      rationale: "Produces stronger evidence coverage across several current gaps."
    },
    {
      title: titleStem + " capstone",
      summary: "Build a compact portfolio-grade capstone that combines the current top competency gaps and can be explained in an interview or evaluation.",
      skillSlugs: slugs,
      technologies: names,
      requirements: [
        "Define one clear problem and a realistic user.",
        "Combine the selected role skills in a coherent architecture.",
        "Include tests or evaluation appropriate to the project.",
        "Deploy or package the result so another person can run it.",
        "Write a short engineering retrospective."
      ],
      milestones: [
        "Scope architecture and success metrics.",
        "Build the main workflow.",
        "Integrate the remaining target competencies.",
        "Test, package, and document the final result."
      ],
      successCriteria: [
        "A reviewer can run or inspect the project without private setup knowledge.",
        "Every targeted skill has concrete implementation evidence.",
        "The project is small enough to finish but substantial enough to discuss technically."
      ],
      estimatedMinutes: 720,
      difficulty: "ADVANCED" as const,
      rationale: "Combines the current highest-value gaps into one portfolio artifact."
    }
  ];
}

export class ProjectRecommendationService {
  async generate(userId: string) {
    const sql = getSql();

    const context = rows(await sql.unsafe(
      `select
         cg.id goal_id,
         gs.id gap_snapshot_id,
         tr.name role_name
       from public.career_goals cg
       join public.role_versions rv on rv.id=cg.role_version_id
       join public.target_roles tr on tr.id=rv.role_id
       join lateral (
         select id
         from public.gap_snapshots
         where user_id=cg.user_id and goal_id=cg.id
         order by created_at desc
         limit 1
       ) gs on true
       where cg.user_id=$1::uuid and cg.status='ACTIVE'
       limit 1`,
      [userId]
    ))[0];

    if (!context) throw new Error("PROJECT_RECOMMENDATION_CONTEXT_MISSING");

    const gaps = rows(await sql.unsafe(
      `select
         sgr.skill_id,
         sgr.priority_score,
         sgr.gap_severity,
         sgr.recommended_action,
         s.slug,
         s.canonical_name,
         s.category
       from public.skill_gap_results sgr
       join public.skills s on s.id=sgr.skill_id
       where sgr.snapshot_id=$1::uuid
         and sgr.status<>'STRONG'
       order by sgr.priority_score desc,sgr.gap_severity desc
       limit 6`,
      [String(context.gap_snapshot_id)]
    ));

    if (!gaps.length) throw new Error("NO_PROJECT_RECOMMENDATION_GAPS");

    const allowedSlugs = new Set(gaps.map(gap => String(gap.slug)));
    const gapPayload = gaps.map(gap => ({
      skillSlug: String(gap.slug),
      name: String(gap.canonical_name),
      category: String(gap.category ?? ""),
      priority: Number(gap.priority_score),
      gapSeverity: Number(gap.gap_severity),
      recommendedAction: String(gap.recommended_action)
    }));

    let recommendations: Array<z.infer<typeof recommendationSchema>> = fallbackRecommendations(String(context.role_name), gaps);

    try {
      const ai = await getGeminiStructuredClient().generateJson({
        systemInstruction:
          "You create small, buildable learning projects for SkillTwin. Use only supplied skillSlugs. "
          + "Projects must produce observable evidence through implementation, tests, artifacts, or evaluation. "
          + "Do not invent user history. Keep scope realistic for a student.",
        prompt:
          "Target role: " + String(context.role_name) + "\n"
          + "Current prioritized gaps:\n" + JSON.stringify(gapPayload) + "\n"
          + "Generate 3 distinct project recommendations. Each should directly exercise the supplied gap skills.",
        jsonSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            recommendations: {
              type: "array",
              minItems: 2,
              maxItems: 3,
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  title: { type: "string" },
                  summary: { type: "string" },
                  skillSlugs: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 5 },
                  technologies: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 10 },
                  requirements: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 8 },
                  milestones: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 8 },
                  successCriteria: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 8 },
                  estimatedMinutes: { type: "integer", minimum: 120, maximum: 2400 },
                  difficulty: { type: "string", enum: ["BASIC","STANDARD","ADVANCED"] },
                  rationale: { type: "string" }
                },
                required: ["title","summary","skillSlugs","technologies","requirements","milestones","successCriteria","estimatedMinutes","difficulty","rationale"]
              }
            }
          },
          required: ["recommendations"]
        },
        validator: responseSchema
      });

      if (ai) {
        const valid = ai.recommendations.filter(item =>
          item.skillSlugs.every(slug => allowedSlugs.has(slug))
        );
        if (valid.length >= 2) recommendations = valid;
      }
    } catch {
      // Deterministic recommendations remain available during AI outages.
    }

    const skillIdBySlug = new Map(gaps.map(gap => [String(gap.slug), String(gap.skill_id)]));

    await sql.begin(async tx => {
      await tx.unsafe(
        "update public.project_recommendations set status='DISMISSED' where user_id=$1::uuid and goal_id=$2::uuid and status='ACTIVE'",
        [userId,String(context.goal_id)]
      );

      for (const recommendation of recommendations) {
        const skillIds = recommendation.skillSlugs
          .map(slug => skillIdBySlug.get(slug))
          .filter((value): value is string => Boolean(value));

        await tx.unsafe(
          "insert into public.project_recommendations(user_id,goal_id,gap_snapshot_id,title,summary,target_skill_ids,technologies,requirements,milestones,success_criteria,estimated_minutes,difficulty,rationale,generator_version,status) values ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12,$13,$14,'ACTIVE')",
          [
            userId,
            String(context.goal_id),
            String(context.gap_snapshot_id),
            recommendation.title,
            recommendation.summary,
            JSON.stringify(skillIds),
            JSON.stringify(recommendation.technologies),
            JSON.stringify(recommendation.requirements),
            JSON.stringify(recommendation.milestones),
            JSON.stringify(recommendation.successCriteria),
            recommendation.estimatedMinutes,
            recommendation.difficulty,
            recommendation.rationale,
            PROJECT_RECOMMENDER_VERSION
          ]
        );
      }

      await tx.unsafe(
        "insert into public.agent_events(user_id,event_type,trigger_type,trigger_ref,summary,entity_refs,metadata) values ($1::uuid,'projects.recommended','GAP_SNAPSHOT',$2,$3,$4::jsonb,$5::jsonb)",
        [
          userId,
          String(context.gap_snapshot_id),
          "Generated " + recommendations.length + " project recommendations for " + String(context.role_name) + ".",
          JSON.stringify([{ type: "gap_snapshot", id: String(context.gap_snapshot_id) }]),
          JSON.stringify({ generatorVersion: PROJECT_RECOMMENDER_VERSION })
        ]
      );
    });

    return this.list(userId);
  }

  async list(userId: string) {
    const sql = getSql();
    const recommendations = rows(await sql.unsafe(
      `select
         pr.*,
         coalesce(jsonb_agg(jsonb_build_object('id',s.id,'slug',s.slug,'name',s.canonical_name))
           filter (where s.id is not null),'[]'::jsonb) skill_details
       from public.project_recommendations pr
       left join lateral jsonb_array_elements_text(pr.target_skill_ids) sid(value) on true
       left join public.skills s on s.id=sid.value::uuid
       where pr.user_id=$1::uuid and pr.status='ACTIVE'
       group by pr.id
       order by pr.created_at desc`,
      [userId]
    ));

    return recommendations.map(row => ({
      ...row,
      target_skill_ids: stringArray(row.target_skill_ids),
      technologies: stringArray(row.technologies),
      requirements: stringArray(row.requirements),
      milestones: stringArray(row.milestones),
      success_criteria: stringArray(row.success_criteria),
      skill_details: parseJson(row.skill_details)
    }));
  }
}

let service: ProjectRecommendationService | null = null;

export function getProjectRecommendationService() {
  if (!service) service = new ProjectRecommendationService();
  return service;
}
