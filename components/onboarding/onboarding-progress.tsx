import { Check, FileText, Map, Sparkles, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type StepState = "done" | "current" | "next";

type Step = {
  label: string;
  detail: string;
  icon: LucideIcon;
  state: StepState;
};

export function OnboardingProgress({
  goalReady,
  skillTwinReady,
  planReady
}: {
  goalReady: boolean;
  skillTwinReady: boolean;
  planReady: boolean;
}) {
  const steps: Step[] = [
    {
      label: "Target",
      detail: goalReady ? "Career goal saved" : "Choose your role",
      icon: Target,
      state: goalReady ? "done" : "current"
    },
    {
      label: "Evidence",
      detail: skillTwinReady ? "Evidence analyzed" : goalReady ? "Add proof of skills" : "After target",
      icon: FileText,
      state: skillTwinReady ? "done" : goalReady ? "current" : "next"
    },
    {
      label: "SkillTwin",
      detail: skillTwinReady ? "Learner state ready" : "Built from evidence",
      icon: Sparkles,
      state: skillTwinReady ? "done" : "next"
    },
    {
      label: "Plan",
      detail: planReady ? "Roadmap ready" : skillTwinReady ? "Ready to generate" : "Adapts to your gaps",
      icon: Map,
      state: planReady ? "done" : skillTwinReady ? "current" : "next"
    }
  ];

  return (
    <section className="surface-card overflow-hidden" aria-label="SkillTwin setup progress">
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="eyebrow">Setup progress</p>
            <p className="mt-1 text-sm text-slate-500">From career target to an evidence-backed adaptive plan.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {steps.filter(step => step.state === "done").length}/4 ready
          </span>
        </div>
      </div>

      <div className="overflow-x-auto px-5 py-5 sm:px-6">
        <div className="relative grid min-w-[620px] grid-cols-4 gap-3">
          <div className="absolute left-[10%] right-[10%] top-5 h-px bg-slate-200" aria-hidden="true" />
          {steps.map((step, index) => {
            const Icon = step.icon;
            const done = step.state === "done";
            const current = step.state === "current";

            return (
              <div key={step.label} className="relative z-10 text-center">
                <span
                  className={
                    "mx-auto flex size-10 items-center justify-center rounded-xl border transition duration-300 " +
                    (done
                      ? "border-emerald-200 bg-emerald-50 text-emerald-600 shadow-sm"
                      : current
                        ? "border-brand-300 bg-brand-50 text-brand-600 shadow-[0_0_0_4px_rgba(91,92,226,0.08)]"
                        : "border-slate-200 bg-white text-slate-400")
                  }
                >
                  {done ? <Check className="size-4.5" strokeWidth={2.5} /> : <Icon className="size-4.5" />}
                </span>
                <p className={"mt-3 text-sm font-semibold " + (current ? "text-brand-700" : done ? "text-slate-800" : "text-slate-500")}>
                  {index + 1}. {step.label}
                </p>
                <p className="mt-1 text-xs text-slate-400">{step.detail}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
