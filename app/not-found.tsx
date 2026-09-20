import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl items-center px-5 py-12 sm:px-6">
      <section className="surface-card w-full p-7 text-center sm:p-10">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
          <Search className="size-5" />
        </span>
        <p className="eyebrow mt-5">Not found</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">This SkillTwin view does not exist.</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-500">
          The link may be stale or the referenced item may no longer be active.
        </p>
        <Link href="/overview" className="btn-primary mt-6">
          <ArrowLeft className="size-4" />
          Return to home
        </Link>
      </section>
    </main>
  );
}
