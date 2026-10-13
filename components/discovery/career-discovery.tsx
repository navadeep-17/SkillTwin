"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, BookOpen, Compass, Database, Info, Search, ShieldAlert, Target
} from "lucide-react";

export type DiscoverableRole = {
  id: string;
  roleId: string;
  name: string;
  family: string;
  version: number;
  source: "SEEDED" | "AI_GENERATED";
  personal: boolean;
  requirementCount: number;
  documentedCount: number;
  requirements: {
    skillId: string;
    name: string;
    category: string;
    importance: string;
    stage: number;
    targetScore: number;
    rationale: string;
  }[];
};

type Props = { roles: DiscoverableRole[] };

const familyAll = "All careers";

function titlecase(value: string) {
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

export function CareerDiscovery({ roles }: Props) {
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState(familyAll);
  const [selectedId, setSelectedId] = useState(roles[0]?.id ?? "");
  const families = useMemo(
    () => [familyAll, ...new Set(roles.map(role => role.family))],
    [roles]
  );

  const filtered = useMemo(() => roles.filter(role => {
    if (family !== familyAll && role.family !== family) return false;
    const queryText = query.trim().toLowerCase();
    if (!queryText) return true;
    return [role.name, role.family, ...role.requirements.map(r => r.name)]
      .some(text => text.toLowerCase().includes(queryText));
  }), [roles, query, family]);
  const selected = filtered.find(role => role.id === selectedId) ?? filtered[0] ?? null;

  return (
    <>
      <header className="max-w-3xl">
        <p className="eyebrow">Career discovery · SkillTwin</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.025em] text-slate-950 sm:text-4xl">
          Explore where your skills could take you.
        </h1>
        <p className="mt-3 text-[15px] leading-7 text-slate-600">
          Browse our currently supported career models, see the competencies each requires,
          and choose a direction to explore in SkillTwin. You do not have to commit to a goal to inspect a role.
        </p>
      </header>

      <div className="mt-6 rounded-xl border border-brand-100 bg-brand-50/60 p-4 text-sm leading-6 text-slate-700">
        <div className="flex items-start gap-3">
          <Info className="mt-1 size-4 shrink-0 text-brand-600" />
          <p>
            <strong>Early-access catalog:</strong> These models cover a limited initial set of careers.
            They describe competencies, not current vacancies, salaries, eligibility or a personal suitability score.
            AI-generated custom roles may require additional expert review.
          </p>
        </div>
      </div>

      <section className="mt-7 grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
        <div className="space-y-4">
          <div className="surface-card p-4">
            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500" htmlFor="career-search">
              Search roles and skills
            </label>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400" />
              <input
                id="career-search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Try 'Data Analyst' or 'Python'"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-400"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Career families">
              {families.map(item => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFamily(item)}
                  aria-pressed={family === item}
                  className={
                    "rounded-lg border px-3 py-1.5 text-xs font-semibold transition " +
                    (family === item
                      ? "border-brand-200 bg-brand-50 text-brand-700"
                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50")
                  }
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filtered.length ? filtered.map(role => {
              const active = selected?.id === role.id;
              return (
                <button
                  type="button"
                  key={role.id}
                  aria-pressed={active}
                  aria-controls="career-details"
                  onClick={() => {
                    setSelectedId(role.id);
                    if (window.innerWidth < 1024) {
                      document.getElementById("career-details")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                  }}
                  className={
                    "w-full rounded-2xl border bg-white p-4 text-left transition duration-200 " +
                    (active ? "border-brand-400 shadow-soft ring-1 ring-brand-100" : "border-slate-200 hover:border-brand-200 hover:shadow-soft")
                  }
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">{role.name}</p>
                    <ArrowRight className={"size-4 shrink-0 " + (active ? "text-brand-600" : "text-slate-400")} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{role.family}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-600">
                    <span className="rounded-md bg-slate-100 px-2 py-1">{role.requirementCount} modeled competencies</span>
                    <span className="rounded-md bg-slate-100 px-2 py-1">{role.personal ? "Your custom role" : "Catalog role"}</span>
                  </div>
                </button>
              );
            }) : (
              <div className="surface-card p-6">
                <p className="font-semibold text-slate-900">No matching roles in the current catalog</p>
                <p className="mt-2 text-sm text-slate-500">Try another term or clear the filters. You can also request a custom role during onboarding.</p>
                <button type="button" className="btn-secondary mt-4" onClick={() => { setQuery(""); setFamily(familyAll); }}>Clear filters</button>
              </div>
            )}
          </div>
        </div>

        <div id="career-details" className="scroll-mt-5">
          {selected ? (
            <div className="surface-card overflow-hidden">
              <div className="hero-wash relative border-b border-slate-200 bg-slate-50/70 p-6 sm:p-7">
                <div className="relative">
                  <p className="eyebrow">{selected.family}</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{selected.name}</h2>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span className="rounded-lg bg-white px-2.5 py-1.5 ring-1 ring-slate-200">Role model v{selected.version}</span>
                    <span className="rounded-lg bg-white px-2.5 py-1.5 ring-1 ring-slate-200">
                      {selected.source === "AI_GENERATED" ? "AI-generated model · unreviewed" : "Seeded starter model"}
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-600">
                    View modeled skill requirements before selecting this career as your target.
                    Requirements may not reflect all qualifications, experience or licensing rules for this profession.
                  </p>
                  <Link className="btn-primary mt-5" href={"/onboarding?role=" + encodeURIComponent(selected.id)}>
                    Explore this as my goal <ArrowRight className="size-4"/>
                  </Link>
                </div>
              </div>

              <div className="p-6 sm:p-7">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 text-xs text-slate-500"><Target className="size-4 text-brand-600" /> Modeled skills</div>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">{selected.requirementCount}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 text-xs text-slate-500"><Database className="size-4 text-brand-600" /> Skills in your existing profile</div>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">{selected.documentedCount} <span className="text-sm font-normal text-slate-400">of {selected.requirementCount}</span></p>
                  </div>
                </div>
                <div className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-500">
                  <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
                  A documented skill can be a self-report or resume mention. This count is not a career-fit score,
                  and a listed skill may still be below the role's target proficiency.
                </div>

                <h3 className="mt-8 text-lg font-semibold text-slate-900">Competencies in the role model</h3>
                <p className="mt-2 text-sm text-slate-500">Ordered by modeled importance. Some requirements are alternative pathways, not mandatory combinations.</p>
                <div className="mt-4 space-y-3">
                  {selected.requirements.length ? selected.requirements.map((requirement, index) => (
                    <article key={requirement.skillId + ":" + index} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-slate-900">{requirement.name}</p>
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">{titlecase(requirement.importance)}</span>
                      </div>
                      <p className="mt-1.5 text-xs text-slate-500">
                        Learning stage {requirement.stage} · Target competency {requirement.targetScore.toFixed(1)} / 4 · {requirement.category}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{requirement.rationale}</p>
                    </article>
                  )) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No competencies currently listed.</p>}
                </div>

                <div className="mt-6 rounded-xl bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <BookOpen className="size-4 text-brand-600"/> Want a career that isn't listed?
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    You can describe a custom target role during onboarding. SkillTwin will mark AI-generated models separately,
                    and those requirements should be reviewed before making major career decisions.
                  </p>
                  <Link href="/onboarding" className="quiet-link mt-3 inline-flex items-center gap-1 font-semibold">
                    Create custom role <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="surface-card p-8 text-center">
              <Compass className="mx-auto size-8 text-brand-600" />
              <p className="mt-3 font-semibold text-slate-900">{roles.length ? "Select a career to view requirements" : "Career catalog is currently empty"}</p>
              <p className="mt-2 text-sm text-slate-500">
                {roles.length ? "Use the search or family filters to discover available role models." : "You can still create a custom role through onboarding."}
              </p>
              <Link href="/onboarding" className="btn-secondary mt-5">Go to onboarding</Link>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
