import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProjectEvidenceForm } from "@/components/projects/project-evidence-form";
import { ProjectRecommendations } from "@/components/projects/project-recommendations";

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

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: projects, error } = await supabase
    .from("profile_projects")
    .select("id,title,description,technologies,artifact_url,analysis_status,analysis_result,created_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">Projects</p>
        <h1 className="mt-2 text-3xl font-semibold">Turn project work into evidence</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Add what you built and how you used the technologies. SkillTwin maps the description to canonical skills, but only the Evidence Engine decides whether capability or confidence changes.
        </p>
      </header>

      <ProjectRecommendations />

      <div className="mt-10 grid gap-8 lg:grid-cols-[.9fr_1.1fr]">
        <ProjectEvidenceForm />

        <section>
          <h2 className="text-xl font-semibold">Submitted projects</h2>
          <div className="mt-4 space-y-4">
            {projects?.length ? projects.map(project => {
              const parsedResult = parseJson(project.analysis_result);
              const result = parsedResult && typeof parsedResult === "object" && !Array.isArray(parsedResult)
                ? parsedResult as Record<string, unknown>
                : {};
              const parsedEvidence = parseJson(result.evidence);
              const evidence = parsedEvidence && typeof parsedEvidence === "object" && !Array.isArray(parsedEvidence)
                ? parsedEvidence as Record<string, unknown>
                : {};
              const deltas = Array.isArray(evidence.deltas) ? evidence.deltas : [];
              const parsedTechnologies = parseJson(project.technologies);
              const technologies = Array.isArray(parsedTechnologies) ? parsedTechnologies : [];

              return (
                <article key={project.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{project.title}</h3>
                      <p className="mt-1 text-xs text-slate-500">{new Date(project.created_at).toLocaleString()}</p>
                    </div>
                    <span
                      className={
                        project.analysis_status === "COMPLETE"
                          ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                          : project.analysis_status === "FAILED"
                            ? "rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700"
                            : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500"
                      }
                    >
                      {project.analysis_status}
                    </span>
                  </div>

                  <p className="mt-3 line-clamp-4 text-sm leading-6 text-slate-600">{project.description}</p>

                  {technologies.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {technologies.map((tech: unknown) => (
                        <span key={String(tech)} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                          {String(tech)}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500">
                    <span>{Number(result.matchedSkills ?? 0)} canonical skills matched</span>
                    <span>{deltas.length} SkillTwin change{deltas.length === 1 ? "" : "s"}</span>
                  </div>

                  {project.artifact_url ? (
                    <a
                      href={project.artifact_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex text-sm font-medium text-brand-700 hover:underline"
                    >
                      Open optional artifact link
                    </a>
                  ) : null}
                </article>
              );
            }) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
                No manual project evidence yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
