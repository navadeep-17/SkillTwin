import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Check,
  CircleCheck,
  Compass,
  FileCheck2,
  Layers3,
  Play,
  Sparkles,
  Target,
  TrendingUp
} from "lucide-react";
import { SkillTwinLogo, SkillTwinMark } from "@/components/brand/skilltwin-logo";

const proof = [
  {
    icon: FileCheck2,
    title: "Evidence-backed",
    detail: "Skills move when your evidence justifies it."
  },
  {
    icon: Layers3,
    title: "Versioned plans",
    detail: "Every roadmap change is tracked and explainable."
  },
  {
    icon: TrendingUp,
    title: "Adaptive validation",
    detail: "Assessments update your SkillTwin and the next step."
  }
];

const features = [
  {
    icon: Layers3,
    title: "A living model of your skills",
    detail: "Resume, projects, practice and assessments become one evidence-backed learner model."
  },
  {
    icon: Compass,
    title: "A roadmap that reacts",
    detail: "Your plan changes only when new evidence, constraints or performance make a change worthwhile."
  },
  {
    icon: BarChart3,
    title: "See what changed",
    detail: "Readiness, evidence coverage, SkillDelta and PlanDiff make progress visible instead of vague."
  }
];

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#fbfbff] text-slate-950">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[720px] overflow-hidden" aria-hidden="true">
        <div className="absolute -left-52 top-40 size-[32rem] rounded-full bg-brand-100/35 blur-3xl" />
        <div className="absolute right-[-9rem] top-12 size-[34rem] rounded-full bg-[#d9ecff]/60 blur-3xl" />
        <div className="absolute right-[6rem] top-[19rem] size-[22rem] rounded-full bg-[#e9dcff]/55 blur-3xl" />
      </div>

      <header className="relative z-20 mx-auto flex max-w-[1440px] items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <Link href="/" aria-label="SkillTwin home">
          <SkillTwinLogo />
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex" aria-label="Landing page">
          <a href="#features" className="transition hover:text-slate-950">Features</a>
          <a href="#how-it-works" className="transition hover:text-slate-950">How it works</a>
          <Link href="/demo" className="transition hover:text-slate-950">Demo</Link>
        </nav>

        <div className="flex items-center gap-2.5">
          <Link
            href="/login"
            className="hidden rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-white/70 hover:text-slate-950 sm:inline-flex"
          >
            Sign in
          </Link>
          <Link href="/onboarding" className="btn-primary px-4.5 shadow-[0_10px_28px_rgba(91,92,226,0.22)]">
            Build my SkillTwin
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid max-w-[1440px] items-center gap-12 px-5 pb-16 pt-10 sm:px-8 md:pt-14 lg:grid-cols-[0.92fr_1.08fr] lg:px-12 lg:pb-20 lg:pt-16">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-white/80 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-700 shadow-sm backdrop-blur">
            <Sparkles className="size-3.5" />
            Evidence-backed · adaptive · built for your next step
          </div>

          <h1 className="mt-7 text-[clamp(3.25rem,6.4vw,6.6rem)] font-semibold leading-[0.92] tracking-[-0.055em] text-slate-950">
            A learning agent
            <span className="mt-1 block bg-gradient-to-r from-[#4f5ce8] via-[#6258e6] to-[#8657ee] bg-clip-text text-transparent">
              that evolves
            </span>
            <span className="block">as you do.</span>
          </h1>

          <p className="mt-7 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            Build an evidence-backed model of your skills, compare it with your target career,
            follow a personalized roadmap, validate what you know, and let the plan adapt when new evidence justifies it.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/onboarding" className="btn-primary min-h-12 px-5 text-[15px] shadow-[0_12px_34px_rgba(91,92,226,0.24)]">
              Build my SkillTwin
              <ArrowRight className="size-4" />
            </Link>
            <Link href="/demo" className="btn-secondary min-h-12 px-5 text-[15px]">
              <span className="flex size-7 items-center justify-center rounded-full bg-slate-900 text-white">
                <Play className="size-3.5 fill-current" />
              </span>
              Watch the demo
            </Link>
          </div>

          <p className="mt-5 text-sm leading-6 text-slate-500">
            Your profile, evidence, roadmap, assessments and plan history stay attached to your account.
          </p>

          <div className="mt-9 grid max-w-2xl gap-3 sm:grid-cols-3">
            {proof.map(item => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-2xl border border-white/80 bg-white/70 p-4 shadow-[0_8px_30px_rgba(16,24,40,0.035)] backdrop-blur">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <Icon className="size-4.5" />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative lg:pl-6">
          <div className="pointer-events-none absolute -inset-10 rounded-[3rem] bg-gradient-to-br from-[#d9ecff]/75 via-brand-100/55 to-[#e9dcff]/70 blur-2xl" aria-hidden="true" />

          <div className="relative overflow-hidden rounded-[2rem] border border-white/90 bg-white/78 p-3 shadow-[0_35px_90px_rgba(72,78,166,0.18)] backdrop-blur-xl sm:p-4">
            <div className="flex items-center justify-between px-2 pb-3">
              <div className="inline-flex items-center gap-2.5 text-sm font-semibold text-slate-700">
                <SkillTwinMark className="size-6" />
                Sample learner view
              </div>
              <span className="rounded-full bg-brand-50 px-3 py-1 text-[11px] font-semibold text-brand-700">LIVE ADAPTATION</span>
            </div>

            <div className="grid min-h-[530px] overflow-hidden rounded-[1.45rem] border border-slate-200/80 bg-white sm:grid-cols-[160px_1fr]">
              <aside className="hidden bg-[#171d35] p-4 text-white sm:block">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-white/10">
                    <SkillTwinMark className="size-6" />
                  </span>
                  <span className="text-sm font-semibold">SkillTwin</span>
                </div>
                <div className="mt-7 space-y-1.5 text-xs font-medium text-slate-300">
                  {[
                    ["Home", true],
                    ["Skills", false],
                    ["Plan", false],
                    ["Practice", false],
                    ["Progress", false]
                  ].map(([label, active]) => (
                    <div
                      key={String(label)}
                      className={"rounded-xl px-3 py-2.5 " + (active ? "bg-brand-500/28 text-white ring-1 ring-white/10" : "")}
                    >
                      {label}
                    </div>
                  ))}
                </div>
              </aside>

              <div className="bg-[#fbfcff] p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold tracking-tight text-slate-950">Your SkillTwin is learning with you.</p>
                    <p className="mt-1 text-xs text-slate-500">Evidence changes the model. The model changes the plan.</p>
                  </div>
                  <span className="hidden rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-500 md:block">
                    Sample state
                  </span>
                </div>

                <div className="mt-5 grid gap-3 xl:grid-cols-[0.95fr_1.05fr]">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-medium text-slate-500">Role readiness</p>
                    <div className="mt-2 flex items-end justify-between">
                      <span className="text-4xl font-semibold tracking-tight text-slate-950">68%</span>
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-600">+9%</span>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-brand-500 to-[#8267ed]" />
                    </div>
                    <p className="mt-2 text-[10px] text-slate-400">Evidence-backed readiness for your target role</p>
                  </div>

                  <div className="rounded-2xl border border-brand-100 bg-gradient-to-br from-white to-brand-50/45 p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                        <Target className="size-4.5" />
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-brand-700">Your next step</p>
                        <p className="mt-1 text-sm font-semibold leading-5 text-slate-900">Validate backend API design</p>
                        <p className="mt-1 text-[11px] text-slate-500">~20 min · high impact</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 xl:grid-cols-[1.05fr_.95fr]">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900">Adaptive roadmap</p>
                      <span className="text-[10px] font-medium text-slate-400">Week 2 of 6</span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {[
                        ["Strengthen backend foundations", "4 of 4 complete", "done"],
                        ["Validate API design", "2 of 4 complete", "active"],
                        ["Build project evidence", "Not started", "next"],
                        ["Re-check role readiness", "Queued", "next"]
                      ].map(([title, detail, state]) => (
                        <div key={title} className="flex items-start gap-3">
                          <span
                            className={
                              "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border " +
                              (state === "done"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                                : state === "active"
                                  ? "border-brand-500 bg-brand-500 text-white"
                                  : "border-slate-300 bg-white text-slate-300")
                            }
                          >
                            {state === "done" ? <Check className="size-3" /> : state === "active" ? <span className="size-1.5 rounded-full bg-white" /> : null}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-800">{title}</p>
                            <p className="mt-0.5 text-[10px] text-slate-400">{detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900">Skill growth</p>
                      <span className="text-[10px] text-slate-400">Recent</span>
                    </div>
                    <div className="mt-5 h-28">
                      <svg viewBox="0 0 220 100" className="h-full w-full" role="img" aria-label="Sample skill growth trend">
                        <defs>
                          <linearGradient id="landing-chart-fill" x1="0" y1="0" x2="0" y2="1">
                            <stop stopColor="#5B5CE2" stopOpacity=".22" />
                            <stop offset="1" stopColor="#5B5CE2" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <path d="M5 80 C28 76, 39 84, 57 68 S88 58, 108 61 S138 45, 158 47 S190 29, 215 31 L215 96 L5 96 Z" fill="url(#landing-chart-fill)" />
                        <path d="M5 80 C28 76, 39 84, 57 68 S88 58, 108 61 S138 45, 158 47 S190 29, 215 31" fill="none" stroke="#5B5CE2" strokeWidth="3" strokeLinecap="round" />
                        {[["5","80"],["57","68"],["108","61"],["158","47"],["215","31"]].map(([cx,cy]) => (
                          <circle key={cx} cx={cx} cy={cy} r="3.8" fill="#5B5CE2" stroke="white" strokeWidth="2" />
                        ))}
                      </svg>
                    </div>
                    <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5">
                      <p className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-800">
                        <Sparkles className="size-3" />
                        Plan adapted from new evidence
                      </p>
                      <p className="mt-1 text-[10px] leading-4 text-amber-700/80">Only the affected tasks changed.</p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/65 p-3.5">
                  <CircleCheck className="size-4.5 shrink-0 text-emerald-600" />
                  <p className="text-[11px] leading-5 text-emerald-800">
                    Your latest assessment strengthened two skills and created a focused PlanDiff.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="relative z-10 mx-auto max-w-[1440px] px-5 pb-20 sm:px-8 lg:px-12">
        <div className="grid gap-4 md:grid-cols-3">
          {features.map(item => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="rounded-3xl border border-slate-200/80 bg-white/86 p-6 shadow-[0_14px_45px_rgba(16,24,40,0.045)] backdrop-blur">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                  <Icon className="size-5" />
                </span>
                <h2 className="mt-5 text-lg font-semibold tracking-tight text-slate-950">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">{item.detail}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="how-it-works" className="relative z-10 border-t border-slate-200/70 bg-white/70">
        <div className="mx-auto grid max-w-[1440px] gap-8 px-5 py-16 sm:px-8 lg:grid-cols-[0.7fr_1.3fr] lg:px-12">
          <div>
            <p className="eyebrow">How it works</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">A closed loop, not a static course list.</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ["01", "Observe", "Resume, projects and assessments become evidence."],
              ["02", "Model", "SkillTwin updates capability and confidence separately."],
              ["03", "Plan", "Your roadmap focuses on the highest-impact gaps."],
              ["04", "Adapt", "New evidence creates explainable changes, not a full reset."]
            ].map(([step, title, detail]) => (
              <div key={step} className="rounded-2xl border border-slate-200 bg-[#fbfbff] p-4">
                <span className="text-xs font-semibold text-brand-600">{step}</span>
                <p className="mt-4 text-sm font-semibold text-slate-900">{title}</p>
                <p className="mt-1.5 text-xs leading-5 text-slate-500">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
