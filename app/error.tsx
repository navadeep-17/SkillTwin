"use client";

import Link from "next/link";
import { AlertTriangle, Home, RefreshCcw } from "lucide-react";

export default function ErrorPage({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl items-center px-5 py-12 sm:px-6">
      <section className="surface-card w-full p-7 text-center sm:p-10">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <AlertTriangle className="size-5" />
        </span>
        <p className="eyebrow mt-5">Something interrupted this view</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
          Your saved SkillTwin state is still safe.
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">
          This screen could not load correctly. Retry the request first; if it keeps happening, return home and continue from the last committed state.
        </p>
        {error.digest ? <p className="mt-3 text-xs text-slate-400">Reference {error.digest}</p> : null}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className="btn-primary">
            <RefreshCcw className="size-4" />
            Try again
          </button>
          <Link href="/overview" className="btn-secondary">
            <Home className="size-4" />
            Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}
