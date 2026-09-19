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
          Evidence-backed skill intelligence, active validation, and a roadmap that changes only when new evidence justifies it.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/overview" className="rounded-xl bg-brand-600 px-5 py-3 font-medium text-white shadow-sm hover:bg-brand-700">
            Open demo
          </Link>
          <Link href="/api/demo/vertical-slice" className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-medium text-slate-700">
            Inspect vertical slice
          </Link>
        </div>
      </div>
    </main>
  );
}
