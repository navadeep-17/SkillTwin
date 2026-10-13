"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, BookOpen, Compass, ExternalLink, FileSearch, Info, LockKeyhole, Search, ShieldAlert } from "lucide-react";

type SourceSkill = {
  name: string;
  importance: number;
  sourceOrder: number;
  mappingStatus: string;
};
type ExploratoryOccupation = {
  occupationId: string;
  onetSocCode: string;
  name: string;
  family: string;
  description: string;
  sourceUrl: string;
  sourceUpdatedYear: number;
  countryContext: string;
  status: string;
  essentialSkills: SourceSkill[];
  transferableSkills: SourceSkill[];
};
type OccupationalSnapshot = {
  snapshotId: string;
  publisher: string;
  sourceProduct: string;
  sourceReleaseContext: string;
  accessedDate: string;
  license: string;
  licenseUrl: string;
  attributionUrl: string;
  selectionNote: string;
  modificationNote: string;
  occupations: ExploratoryOccupation[];
};

export function OccupationAtlas({ snapshot }: { snapshot: OccupationalSnapshot }) {
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("All fields");
  const [selectedId, setSelectedId] = useState(snapshot.occupations[0]?.occupationId ?? "");
  const families = useMemo(
    () => ["All fields", ...new Set(snapshot.occupations.map(item => item.family))].sort((a,b) => a === "All fields" ? -1 : b === "All fields" ? 1 : a.localeCompare(b)),
    [snapshot.occupations]
  );
  const filtered = useMemo(() => snapshot.occupations.filter(item => {
    if (family !== "All fields" && family !== item.family) return false;
    const term = query.trim().toLowerCase();
    return !term || [
      item.name, item.family, item.onetSocCode,
      ...item.essentialSkills.map(skill => skill.name),
      ...item.transferableSkills.map(skill => skill.name)
    ].some(text => text.toLowerCase().includes(term));
  }), [snapshot.occupations, family, query]);

  const active = filtered.find(item => item.occupationId === selectedId) ?? filtered[0] ?? null;
  const occupationCount = snapshot.occupations.length;
  const unmapped = snapshot.occupations.reduce(
    (sum, item) => sum + item.essentialSkills.length + item.transferableSkills.length, 0
  );

  return (
    <>
      <Link href="/discover" className="quiet-link inline-flex items-center gap-1.5">
        <ArrowLeft className="size-4" /> Back to supported career models
      </Link>
      <header className="mt-6 max-w-3xl">
        <p className="eyebrow">Source-backed career intelligence · Exploratory</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
          Explore careers beyond our current models.
        </h1>
        <p className="mt-3 text-[15px] leading-7 text-slate-600">
          Read real occupational descriptions and skills from O*NET OnLine.
          This catalog helps you investigate possibilities—it does not yet generate
          assessed readiness, credentials, or an approved SkillTwin learning plan.
        </p>
      </header>

      <Link href="/occupations/mappings" className="btn-secondary mt-5">Inspect how occupational skills are mapped <ArrowUpRight className="size-4" /></Link>

      <Link href="/occupations/models" className="btn-secondary mt-3 ml-0 sm:ml-3">Review career model readiness <ArrowUpRight className="size-4" /></Link>

      <section aria-label="Catalog coverage" className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat icon={BookOpen} number={String(occupationCount)} label="Source-linked occupations" />
        <Stat icon={Compass} number={String(families.length - 1)} label="Career fields represented" />
        <Stat icon={LockKeyhole} number={String(unmapped)} label="Source skill entries awaiting mapping" />
      </section>

      <section className="mt-5 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-700" />
          <div className="text-sm leading-6 text-amber-950">
            <strong>Exploratory, US-context reference data.</strong> These are selected O*NET descriptions and skills,
            not a complete role specification. Local qualifications, registrations and licensing may be different in India.
            Skill names are not yet mapped to your SkillTwin evidence and must not be used to claim career readiness.
          </div>
        </div>
      </section>

      <div className="mt-7 grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
        <div className="space-y-4">
          <div className="surface-card p-4">
            <label htmlFor="occupations-search" className="text-xs font-semibold uppercase tracking-[.1em] text-slate-500">
              Search occupations, fields or skills
            </label>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400" />
              <input
                id="occupations-search"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm focus:border-brand-500 focus:outline-none"
                placeholder="Nursing, design, critical thinking…"
                value={query}
                onChange={event => setQuery(event.target.value)}
              />
            </div>
            <label htmlFor="occupations-family" className="mt-4 block text-xs font-semibold uppercase tracking-[.1em] text-slate-500">
              Career field
            </label>
            <select
              id="occupations-family"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              value={family}
              onChange={event => setFamily(event.target.value)}
            >
              {families.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            {filtered.map(item => (
              <button
                type="button"
                key={item.occupationId}
                aria-pressed={active?.occupationId === item.occupationId}
                aria-controls="occupation-details"
                onClick={() => {
                  setSelectedId(item.occupationId);
                  if (window.innerWidth < 1024) {
                    document.getElementById("occupation-details")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                }}
                className={"w-full rounded-xl border p-4 text-left transition " +
                  (active?.occupationId === item.occupationId
                    ? "border-brand-400 bg-brand-50/60 shadow-sm"
                    : "border-slate-200 bg-white hover:border-brand-200 hover:bg-slate-50")}
              >
                <p className="font-semibold leading-5 text-slate-900">{item.name}</p>
                <p className="mt-2 text-xs text-slate-500">{item.family} · O*NET {item.onetSocCode}</p>
                <span className="mt-2 inline-block rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-brand-700 ring-1 ring-brand-100">
                  Source-backed · exploratory
                </span>
              </button>
            ))}
            {filtered.length === 0 ? (
              <div className="surface-card p-5">
                <p className="font-semibold text-slate-900">No matching occupations in this snapshot</p>
                <p className="mt-2 text-sm text-slate-500">Try a different search or clear the field filter.</p>
                <button type="button" className="btn-secondary mt-4" onClick={() => { setQuery(""); setFamily("All fields"); }}>Clear filters</button>
              </div>
            ) : null}
          </div>
        </div>

        <div id="occupation-details" className="scroll-mt-5">
          {active ? (
            <article className="surface-card overflow-hidden">
              <header className="border-b border-slate-200 bg-slate-50/70 p-6 sm:p-7">
                <p className="eyebrow">{active.family} · Source-backed profile</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{active.name}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-700">{active.description}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-lg bg-white px-3 py-1.5 text-slate-600 ring-1 ring-slate-200">O*NET–SOC {active.onetSocCode}</span>
                  <span className="rounded-lg bg-white px-3 py-1.5 text-slate-600 ring-1 ring-slate-200">Updated {active.sourceUpdatedYear}</span>
                  <span className="rounded-lg bg-white px-3 py-1.5 text-slate-600 ring-1 ring-slate-200">Exploratory only</span>
                </div>
                <a
                  href={active.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary mt-5"
                >
                  View official occupation profile <ArrowUpRight className="size-4" />
                </a>
              </header>
              <div className="space-y-7 p-6 sm:p-7">
                <SkillSection
                  heading="Essential skills"
                  description="A selected set of skills reported by O*NET OnLine for this occupation."
                  items={active.essentialSkills}
                />
                <SkillSection
                  heading="Transferable skills"
                  description="Occupational skills that may apply in other career contexts. Actual transferability requires evaluation."
                  items={active.transferableSkills}
                />
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2">
                    <Info className="size-4 text-brand-600" />
                    <p className="text-sm font-semibold text-slate-800">Not a verified SkillTwin career model</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    All source skills shown here are currently unmapped to SkillTwin's canonical skill graph.
                    We have not imported role target scores, assessment questions, qualification checks,
                    or readiness calculations for this occupation.
                  </p>
                  <Link className="quiet-link mt-3 inline-flex items-center gap-1.5 font-semibold" href="/discover">
                    See supported SkillTwin roles <ArrowUpRight className="size-3.5"/>
                  </Link>
                </div>
              </div>
            </article>
          ) : <div className="surface-card p-8 text-sm text-slate-600">Choose an occupation to read its sourced profile.</div>}
        </div>
      </div>

      <footer className="mt-8 rounded-xl border border-slate-200 bg-white p-5 text-xs leading-6 text-slate-600">
        <p className="flex items-center gap-2 font-semibold text-slate-900"><FileSearch className="size-4 text-brand-600"/> Source and licensing</p>
        <p className="mt-2">
          Includes information from O*NET OnLine by the U.S. Department of Labor, Employment and Training
          Administration (USDOL/ETA), used under the CC BY 4.0 license. O*NET® is a trademark of USDOL/ETA.
          SkillTwin selected and restructured portions of the information. USDOL/ETA has not approved,
          endorsed, or tested these modifications.
        </p>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
          <a href={snapshot.attributionUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 underline">Attribution terms <ExternalLink className="ml-1 inline size-3"/></a>
          <a href={snapshot.licenseUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 underline">CC BY 4.0 license <ExternalLink className="ml-1 inline size-3"/></a>
        </div>
        <p className="mt-2">Snapshot: {snapshot.snapshotId} · Accessed {snapshot.accessedDate} · {snapshot.sourceReleaseContext}</p>
        <p className="mt-1">Occupation information reflects the United States and may not describe current requirements in other regions.</p>
      </footer>
    </>
  );
}

function Stat({ icon: Icon, number, label }: {
  icon: typeof Compass; number: string; label: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <Icon className="size-5 text-brand-600"/>
      <p className="mt-3 text-2xl font-semibold text-slate-900">{number}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function SkillSection({ heading, description, items }: {
  heading: string; description: string; items: SourceSkill[];
}) {
  return (
    <section>
      <h3 className="text-lg font-semibold text-slate-900">{heading}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        Importance values are O*NET occupation-level importance ratings (0–100); they are not your skill scores.
      </p>
      <ul className="mt-3 space-y-2">
        {items.map(item => (
          <li key={item.name} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
            <div>
              <p className="text-sm font-medium text-slate-900">{item.name}</p>
              <p className="mt-1 text-[11px] text-slate-500">Not mapped to learner evidence</p>
            </div>
            <span className="shrink-0 rounded-md bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600" title="O*NET occupation importance, not your skill proficiency">
              Importance {item.importance}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
