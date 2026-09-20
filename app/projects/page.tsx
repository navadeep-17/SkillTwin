import { redirect } from "next/navigation";
import { CheckCircle2, ExternalLink, FolderKanban, Sparkles } from "lucide-react";
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

  const processed = (projects ?? []).filter(project => project.analysis_status === "COMPLETE").length;
  let totalDeltas = 0;
  for (const project of projects ?? []) {
    const parsedResult = parseJson(project.analysis_result);
    const result = parsedResult && typeof parsedResult === "object" && !Array.isArray(parsedResult)
      ? parsedResult as Record<string, unknown>
      : {};
    const parsedEvidence = parseJson(result.evidence);
    const evidence = parsedEvidence && typeof parsedEvidence === "object" && !Array.isArray(parsedEvidence)
      ? parsedEvidence as Record<string, unknown>
      : {};
    totalDeltas += Array.isArray(evidence.deltas) ? evidence.deltas.length : 0;
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="mb-7 max-w-3xl">
        <p className="eyebrow">Projects</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.025em] text-slate-950">
          Turn real work into stronger evidence.
        </h1>
        <p className="mt-3 text-[15px] leading-7 text-slate-600">
          Add what you built and how you used the technology. SkillTwin maps project claims to canonical skills, while the Evidence Engine decides whether capability or confidence should actually move.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <SummaryMetric icon={FolderKanban} label="Projects submitted" value={String(projects?.length ?? 0)} />
        <SummaryMetric icon={CheckCircle2} label="Processed" value={String(processed)} />
        <SummaryMetric icon={Sparkles} label="SkillTwin changes" value={String(totalDeltas)} />
      </section>

      <ProjectRecommendations />

      <section className="mt-9 grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
        <div className="xl:sticky xl:top-8 xl:self-start">
          <ProjectEvidenceForm />
        </div>

        <div>
          <div>
            <p className="eyebrow">Evidence history</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Submitted projects</h2>
            <p className="mt-1.5 text-sm text-slate-500">Every submitted project keeps its analysis status and evidence impact visible.</p>
          </div>

          <div className="mt-4 space-y-3">
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
                <article key={project.id} className="surface-card p-5 transition duration-200 hover:-translate-y-px hover:shadow-lift">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-900">{project.title}</h3>
                      <p className="mt-1 text-xs text-slate-400">{new Date(project.created_at).toLocaleString()}</p>
                    </div>
                    <StatusBadge status={String(project.analysis_status)} />
                  </div>

                  <p className="mt-3 line-clamp-4 text-sm leading-6 text-slate-600">{project.description}</p>

                  {technologies.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {technologies.map((tech: unknown) => (
                        <span key={String(tech)} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                          {String(tech)}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Mapped skills</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">{Number(result.matchedSkills ?? 0)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">SkillTwin changes</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">{deltas.length}</p>
                    </div>
                  </div>

                  {project.artifact_url ? (
                    <a
                      href={project.artifact_url}
                      target="_blank"
                      rel="noreferrer"
                      className="quiet-link mt-4 inline-flex items-center gap-1.5"
                    >
                      Open artifact <ExternalLink className="size-3.5" />
                    </a>
                  ) : null}
                </article>
              );
            }) : (
              <div className="surface-card p-7 text-center">
                <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                  <FolderKanban className="size-5" />
                </span>
                <p className="mt-4 text-sm font-semibold text-slate-800">No project evidence yet</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Add a project with concrete implementation details to create traceable evidence.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function SummaryMetric({
  icon: Icon,
  label,
  value
}: {
  icon: typeof FolderKanban;
  label: string;
  value: string;
}) {
  return (
    <div className="surface-card flex items-center gap-3 p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <Icon className="size-4.5" />
      </span>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-0.5 text-xl font-semibold tracking-tight text-slate-950">{value}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const classes =
    status === "COMPLETE"
      ? "bg-emerald-50 text-emerald-700"
      : status === "FAILED"
        ? "bg-rose-50 text-rose-700"
        : "bg-slate-100 text-slate-600";

  return (
    <span className={"rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] " + classes}>
      {status.toLowerCase().replace(/_/g, " ")}
    </span>
  );
}
