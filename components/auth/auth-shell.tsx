import type { ReactNode } from "react";
import { BrainCircuit, ShieldCheck, Sparkles, Workflow } from "lucide-react";

export function AuthShell({
  eyebrow,
  title,
  description,
  children
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#F7F8FA] p-3 sm:p-5">
      <div className="mx-auto grid min-h-[calc(100vh-24px)] max-w-6xl overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(16,24,40,0.08)] sm:min-h-[calc(100vh-40px)] lg:grid-cols-[1.05fr_.95fr]">
        <section className="relative hidden overflow-hidden bg-[#111827] p-10 text-white lg:flex lg:flex-col">
          <div className="absolute -right-28 -top-28 size-96 rounded-full bg-brand-500/20 blur-3xl" />
          <div className="absolute -bottom-32 left-10 size-80 rounded-full bg-indigo-400/10 blur-3xl" />

          <div className="relative">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-brand-500 text-sm font-bold shadow-[0_10px_30px_rgba(91,92,226,0.3)]">
                S
              </span>
              <div>
                <p className="font-semibold tracking-tight">SkillTwin</p>
                <p className="text-xs text-slate-400">Adaptive learning agent</p>
              </div>
            </div>

            <h2 className="mt-16 max-w-md text-4xl font-semibold tracking-[-0.03em]">
              A learner model that evolves when the evidence changes.
            </h2>
            <p className="mt-4 max-w-lg text-[15px] leading-7 text-slate-300">
              SkillTwin connects your profile, target role, learning plan, assessments, and roadmap adaptations into one persistent journey.
            </p>

            <div className="mt-10 space-y-4">
              <Feature icon={BrainCircuit} title="Evidence-backed skills" text="Capability and confidence remain separate and traceable." />
              <Feature icon={Workflow} title="Adaptive roadmap" text="Only future work that needs to change gets patched." />
              <Feature icon={ShieldCheck} title="Human-controlled actions" text="Agent actions are grounded, explicit, and auditable." />
            </div>
          </div>

          <div className="relative mt-auto pt-10 text-xs text-slate-500">
            Product Space AI Agent Hackathon 2026
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-10 lg:px-12">
          <div className="w-full max-w-md">
            <div className="flex items-center gap-2 lg:hidden">
              <span className="flex size-9 items-center justify-center rounded-xl bg-brand-500 text-xs font-bold text-white">S</span>
              <span className="font-semibold tracking-tight text-slate-950">SkillTwin</span>
            </div>

            <div className="mt-10 lg:mt-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700">
                <Sparkles className="size-3.5" />
                {eyebrow}
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-[-0.025em] text-slate-950">{title}</h1>
              <p className="mt-3 text-sm leading-6 text-slate-500">{description}</p>
            </div>

            <div className="mt-7">{children}</div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Feature({
  icon: Icon,
  title,
  text
}: {
  icon: typeof BrainCircuit;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.08] text-indigo-300 ring-1 ring-white/10">
        <Icon className="size-4.5" />
      </span>
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-400">{text}</p>
      </div>
    </div>
  );
}
