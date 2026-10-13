"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight, CircleAlert, ClipboardList, Compass, FileCheck2,
  Info, LockKeyhole, Search, ShieldAlert
} from "lucide-react";
import type { DraftModelSummary } from "@/lib/domain/reviewed-career-model";

export function CareerModelBuilder({
  models, sourceSnapshotId, catalogSnapshotId
}: {
  models: DraftModelSummary[];
  sourceSnapshotId: string;
  catalogSnapshotId: string;
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(models[0]?.occupationId ?? "");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return models.filter(model => !q || [model.name, model.family,
      ...model.sourceSkills.map(skill => skill.sourceName)
    ].some(item => item.toLowerCase().includes(q)));
  }, [models, search]);
  const selected = filtered.find(m => m.occupationId === selectedId) ?? filtered[0] ?? null;
  const mappingCount = models.reduce((n, item) => n + item.approvedMappings, 0);
  const requirementCount = models.reduce((n, item) => n + item.configuredRequirements, 0);

  return (
    <>
      <header className="mt-6 max-w-3xl">
        <p className="eyebrow">Occupation intelligence · Review workbench</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
          Reviewed Career Model Builder
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Track what it takes to turn a source-backed occupation into a reviewable
          SkillTwin role model. Approved skill mappings, role requirements, and independently
          evaluated assessments are separate gates—not the same thing.
        </p>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="Review pipeline overview">
        <Metric label="Exploratory occupations" value={models.length} />
        <Metric label="Approved skill mappings" value={mappingCount} />
        <Metric label="Human-configured requirements" value={requirementCount} />
      </section>

      <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-700" />
        <p className="text-sm leading-6 text-amber-950">
          <strong>None of these occupations is approved for assessed learning.</strong> They remain exploratory until
          skill equivalences, target proficiency, professional requirements and assessment validity are
          independently reviewed. These counts are about model preparation, not your ability or likelihood of employment.
        </p>
      </div>

      <section className="mt-6 grid gap-5 lg:grid-cols-[.75fr_1.25fr]">
        <div className="space-y-3">
          <div className="surface-card p-4">
            <label htmlFor="role-builder-search" className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Search occupations and requirements
            </label>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400"/>
              <input
                id="role-builder-search"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Nurse, Teacher, Critical Thinking…"
                className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>
          {filtered.map(model => (
            <button
              key={model.occupationId}
              type="button"
              aria-pressed={selected?.occupationId === model.occupationId}
              aria-controls="builder-model-details"
              onClick={() => {
                setSelectedId(model.occupationId);
                if (window.innerWidth < 1024) {
                  document.getElementById("builder-model-details")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
              className={"w-full rounded-xl border p-4 text-left transition " +
                (selected?.occupationId === model.occupationId
                  ? "border-brand-400 bg-brand-50/60 shadow-sm"
                  : "border-slate-200 bg-white hover:border-brand-200")}
            >
              <span className="text-sm font-semibold text-slate-900">{model.name}</span>
              <p className="mt-1 text-xs text-slate-500">{model.family} · US occupation source</p>
              <p className="mt-2 text-xs text-slate-600">
                {model.approvedMappings}/{model.sourceSkillCount} mappings reviewed · {model.configuredRequirements} requirements configured
              </p>
            </button>
          ))}
          {!filtered.length ? <div className="surface-card p-5 text-sm text-slate-600">No matches in the nine curated occupations.</div> : null}
        </div>

        <div id="builder-model-details" className="scroll-mt-6">
          {selected ? (
            <article className="surface-card overflow-hidden">
              <header className="border-b border-slate-200 bg-slate-50/80 p-6 sm:p-7">
                <p className="eyebrow">{selected.family} · Draft, not active</p>
                <h2 className="mt-3 text-2xl font-semibold text-slate-950">{selected.name}</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">EXPLORATORY</span>
                  <span className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">{selected.jurisdiction} reference</span>
                </div>
                <a href={selected.sourceUrl} target="_blank" rel="noopener noreferrer"
                  className="btn-secondary mt-5">
                  Original O*NET occupation <ArrowUpRight className="size-4"/>
                </a>
              </header>
              <div className="space-y-7 p-6 sm:p-7">
                <section>
                  <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                    <ClipboardList className="size-5 text-brand-600"/> Source-to-model pipeline
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    {selected.approvedMappings} source entries have approved canonical references,
                    and {selected.configuredRequirements} have complete reviewer-authored requirements.
                    O*NET importance is never converted into a SkillTwin target score.
                  </p>
                </section>

                <section>
                  <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                    <CircleAlert className="size-5 text-amber-700"/> Activation blockers
                  </h3>
                  <ul className="mt-3 space-y-2">
                    {selected.blockers.map(blocker => (
                      <li key={blocker} className="flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50/50 p-3 text-sm leading-6 text-amber-950">
                        <LockKeyhole className="mt-1 size-4 shrink-0"/> {blocker}
                      </li>
                    ))}
                  </ul>
                </section>

                <section>
                  <h3 className="text-lg font-semibold text-slate-900">Source skills and review state</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Status describes *mapping approval*, not whether a learner has demonstrated a skill.
                  </p>
                  <div className="mt-3 space-y-2">
                    {selected.sourceSkills.map(item => (
                      <div key={item.sourceSkillKey} className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">{item.sourceName}</p>
                          <span className={"rounded-md px-2 py-1 text-[11px] font-semibold " +
                            (item.mappingStatus === "APPROVED" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}>
                            {item.mappingStatus.replace(/_/g," ")}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {item.sourceGroup === "ESSENTIAL" ? "O*NET essential" : "O*NET transferable"}
                          {" · "} O*NET importance {item.importance}/100 (not proficiency)
                        </p>
                        {item.canonicalSkillSlug ? (
                          <p className="mt-1 text-xs text-slate-600">
                            Approved canonical ID: {item.canonicalSkillSlug}
                            {" · "}{item.configured ? "Requirement metadata reviewed" : "Proficiency/rationale not yet configured"}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>

                <aside className="rounded-xl border border-brand-100 bg-brand-50/40 p-4">
                  <p className="flex items-center gap-2 font-semibold text-slate-900">
                    <Info className="size-4 text-brand-600"/> What a reviewed model requires
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Reviewers must approve source skill equivalences and explicitly author target levels,
                    importance, learning stages and rationale. Separate assessment and local qualification reviews
                    remain mandatory before any model can be activated.
                  </p>
                  <Link href="/occupations/mappings" className="quiet-link mt-3 inline-flex items-center gap-1.5 font-semibold text-brand-700">
                    Inspect skill mapping queue <ArrowUpRight className="size-4"/>
                  </Link>
                </aside>
              </div>
            </article>
          ) : (
            <div className="surface-card p-8 text-sm text-slate-600">
              <Compass className="mb-3 size-8 text-brand-600"/>
              Select an occupation to inspect draft readiness.
            </div>
          )}
        </div>
      </section>

      <footer className="mt-7 rounded-xl border border-slate-200 bg-white p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <FileCheck2 className="size-4 text-brand-600"/> Versioned sources
        </p>
        <p className="mt-2 break-all text-xs leading-6 text-slate-600">
          Occupations: {sourceSnapshotId} · Canonical taxonomy: {catalogSnapshotId}
        </p>
        <p className="mt-2 text-xs leading-6 text-slate-600">
          O*NET OnLine by USDOL/ETA, used under CC BY 4.0. SkillTwin's selected
          and modified material is not endorsed or tested by USDOL/ETA. This page has
          no controls that modify a learner goal, assessment, or role model.
        </p>
      </footer>
    </>
  );
}
function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-600">{label}</p>
    </div>
  );
}
