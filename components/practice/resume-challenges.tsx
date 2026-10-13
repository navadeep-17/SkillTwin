import Link from "next/link";
import { ArrowRight, RotateCcw } from "lucide-react";

export type UnfinishedChallenge = {
  id: string;
  name: string;
  answered: number;
  createdAt: string;
};

export function ResumeChallenges({ challenges }: { challenges: UnfinishedChallenge[] }) {
  if (!challenges.length) return null;
  return (
    <section className="mb-5 rounded-2xl border border-brand-100 bg-brand-50/40 p-5 sm:p-6" aria-labelledby="unfinished-challenges-title">
      <div className="flex flex-wrap items-center gap-2">
        <RotateCcw className="size-5 text-brand-600" />
        <h2 id="unfinished-challenges-title" className="text-lg font-semibold text-slate-900">
          Continue where you left off
        </h2>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Your submitted answers are saved as you go. Resume an unfinished challenge instead of starting over.
        A skill summary is committed only when the assessment is completed.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {challenges.map(item => (
          <Link
            key={item.id}
            href={"/practice/" + item.id}
            className="group flex items-center justify-between gap-3 rounded-xl border border-brand-100 bg-white p-4 transition hover:border-brand-300 hover:shadow-sm"
          >
            <div>
              <p className="text-sm font-semibold text-slate-900">{item.name}</p>
              <p className="mt-1 text-xs text-slate-500">
                {item.answered === 0 ? "Not started yet" : item.answered + " answer" + (item.answered === 1 ? "" : "s") + " saved"}
                {" · Started "}{new Date(item.createdAt).toLocaleDateString("en-IN", { day:"numeric", month:"short" })}
              </p>
            </div>
            <ArrowRight className="size-4 shrink-0 text-brand-600 transition group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </section>
  );
}
