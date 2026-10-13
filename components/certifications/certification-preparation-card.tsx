"use client";

import {BookOpen,CheckCircle2,ExternalLink,Lightbulb,ShieldAlert} from "lucide-react";
import type {PreparationPlan} from "@/lib/domain/certification-preparation";

export function CertificationPreparationCard({plan}:{plan:PreparationPlan}){
  const current=plan.nextStep;
  const grouped=plan.steps.filter(step=>step.phase==="PREREQUISITES");
  return <section className="space-y-4 rounded-xl border border-indigo-100 bg-indigo-50/30 p-4 sm:p-5">
    <div className="flex items-start gap-2">
      <BookOpen className="mt-0.5 size-5 text-indigo-600"/>
      <div>
        <h3 className="font-semibold text-slate-900">Personalized preparation guide</h3>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          Based on the issuer's published learning objectives, your documented SkillTwin gaps,
          and your self-reported study checklist.
        </p>
      </div>
    </div>
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Suggested next step</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{current?.title??"Review the issuer's current requirements"}</p>
      <p className="mt-1 text-xs leading-5 text-slate-600">{current?.details??"Review the latest exam guide."}</p>
      {current?<a href={current.resource.url} target="_blank" rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:underline">
        Open official resource <ExternalLink className="size-3.5"/>
      </a>:null}
    </div>
    {grouped.length?<div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
      <p className="flex items-start gap-2 text-xs font-semibold text-amber-800">
        <ShieldAlert className="mt-0.5 size-4 shrink-0"/> Missing documented prerequisites
      </p>
      <p className="mt-1 text-xs leading-5 text-amber-800">
        {grouped.map(step=>step.title.replace(/^Strengthen /,"")).join(", ")}. This indicates
        missing evidence, not proven lack of ability.
      </p>
    </div>:null}
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Official learning resources</p>
      <ul className="mt-2 space-y-2">
        {plan.resources.map(resource=><li key={resource.url}>
          <a href={resource.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm font-medium text-indigo-700 hover:border-indigo-300">
            <span>{resource.title}</span><ExternalLink className="size-4 shrink-0"/>
          </a>
          <p className="mt-1 px-1 text-[11px] text-slate-500">
            {resource.issuer} · {resource.access} · Reviewed {resource.reviewedOn}
          </p>
        </li>)}
      </ul>
    </div>
    <p className="flex items-start gap-2 text-xs leading-5 text-slate-600">
      <Lightbulb className="mt-0.5 size-4 shrink-0 text-indigo-600"/>
      {plan.guidance[0]}
    </p>
    <div className="flex items-start gap-2 border-t border-indigo-100 pt-3 text-xs text-slate-600">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-slate-400"/>
      <p>{plan.studyCoveragePercent}% of syllabus study topics marked complete.
        This is <strong>not</strong> an issuer exam-readiness or pass-probability score.</p>
    </div>
  </section>;
}
