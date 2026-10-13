"use client";

import { useState } from "react";
import { ArrowLeftRight, CheckCircle2, CircleHelp, GitCompareArrows } from "lucide-react";
import type { DiscoverableRole } from "@/components/discovery/career-discovery";
import { compareCareerRequirements, type CareerRequirementSketch } from "@/lib/domain/career-transferability";

function asSketch(role: DiscoverableRole): CareerRequirementSketch[] {
  return role.requirements.map(item => ({
    skillId: item.skillId,
    name: item.name,
    groupName: item.groupName,
    groupType: item.groupType,
    documented: item.documented
  }));
}

function alternateLabel(type: CareerRequirementSketch["groupType"], name: string) {
  if (type === "ANY_OF") return "One option in: " + name;
  if (type === "ALL_OF") return "Combined group: " + name;
  return null;
}

export function CareerComparisonPanel({ selected, roles }: {
  selected: DiscoverableRole;
  roles: DiscoverableRole[];
}) {
  const [otherId, setOtherId] = useState("");
  const other = roles.find(role => role.id === otherId && role.id !== selected.id) ?? null;
  const comparison = other ? compareCareerRequirements(asSketch(selected), asSketch(other)) : null;

  return (
    <section className="mt-8 rounded-2xl border border-brand-100 bg-brand-50/30 p-4 sm:p-5" aria-labelledby="career-compare-heading">
      <div className="flex items-center gap-2">
        <GitCompareArrows className="size-5 text-brand-600" />
        <h3 id="career-compare-heading" className="text-lg font-semibold text-slate-900">
          Compare career requirements
        </h3>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        See which modeled skills occur in both careers and what each career adds.
        Comparing roles does not change your career goal or your skill estimates.
      </p>
      <label htmlFor="compare-other-career" className="mt-4 block text-sm font-semibold text-slate-700">
        Compare {selected.name} with
      </label>
      <select
        id="compare-other-career"
        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-brand-500"
        value={other?.id ?? ""}
        onChange={event => setOtherId(event.target.value)}
      >
        <option value="">Choose another career</option>
        {roles.filter(role => role.id !== selected.id).map(role => (
          <option key={role.id} value={role.id}>
            {role.name} ({role.family})
          </option>
        ))}
      </select>

      {comparison && other ? (
        <div className="mt-5 space-y-4" aria-live="polite">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Metric label="Shared skills" value={comparison.shared.length} />
            <Metric label="Shared with recorded profile skill" value={comparison.recordedSharedCount} />
            <div className="col-span-2 sm:col-span-1"><Metric label="Distinct skills across both roles" value={comparison.leftOnly.length + comparison.rightOnly.length} /></div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="font-semibold text-slate-900">Skills appearing in both models</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              These names match the same canonical SkillTwin skill IDs, but target proficiency and alternative pathways may differ.
            </p>
            {comparison.shared.length ? (
              <ul className="mt-3 space-y-2">
                {comparison.shared.slice(0, 10).map(skill => (
                  <li key={skill.skillId} className="rounded-lg border border-slate-100 p-3">
                    <div className="flex items-start gap-2">
                      {skill.documented
                        ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-600" />
                        : <CircleHelp className="mt-0.5 size-4 shrink-0 text-slate-400" />}
                      <div>
                        <p className="text-sm font-medium text-slate-900">{skill.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {skill.documented ? "Recorded in your profile — not independently verified" : "No estimated level recorded in your profile"}
                        </p>
                        {alternateLabel(skill.leftGroupType, skill.leftGroupName) || alternateLabel(skill.rightGroupType, skill.rightGroupName) ? (
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {selected.name}: {alternateLabel(skill.leftGroupType, skill.leftGroupName) ?? "Listed competency"};
                            {" "}{other.name}: {alternateLabel(skill.rightGroupType, skill.rightGroupName) ?? "Listed competency"}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
                {comparison.shared.length > 10 ? (
                  <li className="text-xs text-slate-500">+ {comparison.shared.length - 10} more shared skills in the models</li>
                ) : null}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-600">No canonical skill IDs are shared between these two current models. This does not prove that real-world skills cannot transfer.</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <DifferenceList title={"Only in " + selected.name} items={comparison.leftOnly} />
            <DifferenceList title={"Only in " + other.name} items={comparison.rightOnly} />
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs leading-5 text-amber-900">
            <ArrowLeftRight className="mt-0.5 size-4 shrink-0" />
            <p>
              Structural comparison only — not a career-fit percentage, job-readiness estimate,
              or qualification assessment. Unrecorded is unknown, not a zero score.
              Some competencies are alternatives (ANY_OF), not cumulative requirements.
              AI-generated role models may be incomplete.
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-xs leading-5 text-slate-500">
          Choose another role to inspect shared and distinct modeled competencies. No changes are saved.
        </p>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-brand-100 bg-white px-3 py-3">
      <p className="text-xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs leading-4 text-slate-600">{label}</p>
    </div>
  );
}

function DifferenceList({ title, items }: { title: string; items: CareerRequirementSketch[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h4 className="text-sm font-semibold leading-5 text-slate-900">{title}</h4>
      <p className="mt-1 text-xs text-slate-500">{items.length} different modeled skills</p>
      {items.length ? (
        <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-700">
          {items.slice(0, 8).map(item => (
            <li key={item.skillId}>
              <span className="font-medium">{item.name}</span>
              {item.groupType === "ANY_OF" ? (
                <span className="block text-slate-500">Alternative pathway: {item.groupName}</span>
              ) : null}
            </li>
          ))}
          {items.length > 8 ? <li className="text-slate-500">+ {items.length - 8} more</li> : null}
        </ul>
      ) : <p className="mt-3 text-xs text-slate-500">No unique competencies in this model.</p>}
    </div>
  );
}
