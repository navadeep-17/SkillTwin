import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-20">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-600">SkillTwin</p>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
          A learning agent that evolves as you do.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
          Build an evidence-backed model of your skills, compare it with your target career,
          follow a personalized roadmap, validate what you know, and let the plan adapt when new evidence justifies it.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/onboarding" className="rounded-xl bg-brand-600 px-5 py-3 font-medium text-white shadow-sm hover:bg-brand-700">
            Build my SkillTwin
          </Link>
          <Link href="/login" className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-medium text-slate-700">
            Sign in
          </Link>
        </div>
        <p className="mt-6 text-sm text-slate-500">
          Your profile, evidence, roadmap, assessments, and plan history are persisted to your account.
        </p>
      </div>
    </main>
  );
}
