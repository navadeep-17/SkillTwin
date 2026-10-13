"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, CircleHelp, GitPullRequest, Search, ShieldAlert } from "lucide-react";
import type { SourceSkillReviewItem, CanonicalSkill } from "@/lib/domain/occupation-mapping";

type Filter = "ALL" | "PENDING" | "APPROVED" | "REJECTED" | "NEEDS_NEW_SKILL";

export function MappingReviewQueue({queue,catalogSkills}:{
  queue:SourceSkillReviewItem[];
  catalogSkills:CanonicalSkill[];
}) {
  const [query,setQuery]=useState("");
  const [filter,setFilter]=useState<Filter>("ALL");
  const skillsBySlug=useMemo(()=>new Map(catalogSkills.map(s=>[s.slug,s])),[catalogSkills]);
  const filtered=useMemo(()=>queue.filter(item=>{
    if(filter!=="ALL"&&filter!==item.status)return false;
    const q=query.trim().toLowerCase();
    return !q||item.sourceName.toLowerCase().includes(q)||
      item.sourceOccupations.some(o=>o.name.toLowerCase().includes(q))||
      item.suggestions.some(s=>s.name.toLowerCase().includes(q));
  }),[queue,filter,query]);
  const counts={
    PENDING:queue.filter(x=>x.status==="PENDING").length,
    APPROVED:queue.filter(x=>x.status==="APPROVED").length,
    REJECTED:queue.filter(x=>x.status==="REJECTED").length,
    NEEDS_NEW_SKILL:queue.filter(x=>x.status==="NEEDS_NEW_SKILL").length
  };
  return (
    <>
      <section className="mt-6 grid gap-3 sm:grid-cols-4" aria-label="Mapping review progress">
        <Counter label="Pending" value={counts.PENDING} />
        <Counter label="Approved" value={counts.APPROVED} />
        <Counter label="Rejected" value={counts.REJECTED} />
        <Counter label="Needs new skill" value={counts.NEEDS_NEW_SKILL} />
      </section>
      <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        <ShieldAlert className="mt-1 size-5 shrink-0 text-amber-700"/>
        <p>
          This queue contains unique O*NET source skill labels, not individual occupation occurrences.
          Repeated labels retain links to each occupation in which they appear.
          A suggestion is not an approved mapping; O*NET importance values are not learner proficiency scores.
        </p>
      </div>
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[210px] flex-1 text-xs font-semibold text-slate-600">
            Search source skills and occupations
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400"/>
              <input
                value={query}
                onChange={event=>setQuery(event.target.value)}
                placeholder="Critical Thinking, Nursing…"
                className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 text-sm font-normal outline-none focus:border-brand-400"
              />
            </div>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Review state
            <select className="mt-2 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal" value={filter} onChange={e=>setFilter(e.target.value as Filter)}>
              <option value="ALL">All ({queue.length})</option>
              <option value="PENDING">Pending ({counts.PENDING})</option>
              <option value="APPROVED">Approved ({counts.APPROVED})</option>
              <option value="REJECTED">Rejected ({counts.REJECTED})</option>
              <option value="NEEDS_NEW_SKILL">Needs new skill ({counts.NEEDS_NEW_SKILL})</option>
            </select>
          </label>
        </div>
      </section>

      <section className="mt-4 grid gap-3 md:grid-cols-2" aria-label="Source skill mapping review queue">
        {filtered.map(item=>(
          <article key={item.sourceSkillKey} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-base font-semibold text-slate-900">{item.sourceName}</p>
              <span className={"rounded-md px-2 py-1 text-[11px] font-semibold "+(item.status==="APPROVED"?"bg-emerald-50 text-emerald-700":item.status==="PENDING"?"bg-amber-50 text-amber-800":"bg-slate-100 text-slate-700")}>
                {item.status.replace(/_/g," ")}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {item.sourceGroup==="ESSENTIAL"?"Essential skill":"Transferable skill"} · Listed in {item.sourceOccupations.length} source occupation(s)
            </p>
            {item.review?.decision==="APPROVED"? (
              <p className="mt-3 flex items-start gap-2 text-sm text-slate-700">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                Reviewed mapping: <strong>{skillsBySlug.get(item.review.canonicalSkillSlug??"")?.name ?? "Canonical skill"}</strong>
              </p>
            ):item.review?(
              <p className="mt-3 text-sm text-slate-600">{item.review.decision==="NEEDS_NEW_SKILL"?"No appropriate existing canonical skill approved.":"Mapping rejected by reviewer."}</p>
            ):(
              <p className="mt-3 flex items-start gap-2 text-sm text-slate-600">
                <CircleHelp className="mt-0.5 size-4 shrink-0 text-slate-400"/>
                No human-approved mapping yet.
              </p>
            )}
            {item.suggestions.length&&item.status==="PENDING"?(
              <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                <p className="font-semibold text-slate-700">Lexical candidates only — require review</p>
                {item.suggestions.map(s=><p className="mt-1" key={s.slug}>{s.name} · {s.method==="EXACT_LABEL"?"same normalized label":"shared name tokens"}</p>)}
              </div>
            ):null}
            {item.review?(
              <div className="mt-3 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-600">
                <p><strong>Reviewer:</strong> {item.review.reviewer} · {new Date(item.review.reviewedAt).toLocaleDateString("en-IN")}</p>
                <p className="mt-1"><strong>Rationale:</strong> {item.review.rationale}</p>
              </div>
            ):null}
            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="text-xs font-semibold text-slate-500">Source occupations</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {item.sourceOccupations.slice(0,4).map(o=>(
                  <a key={o.occupationId} target="_blank" rel="noopener noreferrer" href={o.url} className="rounded-md bg-slate-50 px-2 py-1 text-xs text-brand-700 underline">
                    {o.name}
                  </a>
                ))}
                {item.sourceOccupations.length>4?<span className="text-xs text-slate-500">+{item.sourceOccupations.length-4} more</span>:null}
              </div>
            </div>
          </article>
        ))}
        {filtered.length===0?(
          <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">No mapping entries match these filters.</p>
        ):null}
      </section>
      <div className="mt-6 rounded-xl border border-brand-100 bg-brand-50/40 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <GitPullRequest className="size-4 text-brand-600"/> Human review is recorded through GitHub pull requests
        </p>
        <p className="mt-2 text-xs leading-6 text-slate-600">
          The production interface is intentionally read-only. Reviewers use the repository CLI to propose a decision,
          document rationale, and submit it for code review. No learner information is included in these mappings.
        </p>
      </div>
    </>
  );
}
