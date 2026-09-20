"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, LoaderCircle, ShieldCheck, Sparkles, Target } from "lucide-react";
import { useRouter } from "next/navigation";

export function ChallengeLauncher() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function startChallenge() {
    setPending(true);
    setError("");

    try {
      const response = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "CHALLENGE_ME" })
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setError(payload.error?.message ?? "Could not start Challenge Me.");
        return;
      }

      router.push("/practice/" + payload.data.assessment.id);
    } catch {
      setError("Could not start Challenge Me.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="surface-card hero-wash relative overflow-hidden">
      <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.15fr_.85fr] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50/80 px-3 py-1.5 text-xs font-semibold text-brand-700">
            <Sparkles className="size-3.5" />
            Active validation
          </div>
          <h2 className="mt-5 max-w-xl text-3xl font-semibold tracking-[-0.025em] text-slate-950">
            Test the skill that matters most next.
          </h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-600">
            SkillTwin chooses an assessable target from your latest role gaps, evidence confidence, and the validated question bank. A challenge can mix MCQs, short answers, and scenarios when the bank supports them.
          </p>

          {error ? (
            <p className="mt-5 rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>
          ) : null}

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={startChallenge}
              disabled={pending}
              className="btn-primary !px-5 !py-3"
            >
              {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Target className="size-4" />}
              {pending ? "Preparing challenge" : "Start Challenge Me"}
              {!pending ? <ArrowRight className="size-4" /> : null}
            </button>
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <ShieldCheck className="size-3.5 text-emerald-600" />
              One committed summary evidence item per completed challenge
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-soft backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">After you finish</p>
          <div className="mt-4 space-y-4">
            <Step number="01" title="Assessment outcome is stored" detail="Per-question results remain challenge-local." />
            <Step number="02" title="Evidence Engine receives a summary" detail="The evaluator does not directly mutate your skill state." />
            <Step number="03" title="SkillTwin is recomputed" detail="Capability and confidence may move independently." />
            <Step number="04" title="Your plan can adapt" detail="Role gaps refresh and only affected future work is patched." last />
          </div>
        </div>
      </div>

      {pending ? (
        <div className="soft-pop border-t border-brand-100 bg-brand-50/60 px-6 py-4 sm:px-8">
          <div className="flex items-center gap-3 text-sm text-brand-800">
            <span className="flex size-8 items-center justify-center rounded-lg bg-white shadow-sm">
              <LoaderCircle className="size-4 animate-spin text-brand-600" />
            </span>
            <div>
              <p className="font-semibold">Selecting a high-value validation target</p>
              <p className="mt-0.5 text-xs text-brand-700/80">Using your current gaps, uncertainty, and available assessment coverage.</p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Step({
  number,
  title,
  detail,
  last = false
}: {
  number: string;
  title: string;
  detail: string;
  last?: boolean;
}) {
  return (
    <div className="relative flex gap-3">
      {!last ? <span className="absolute left-4 top-8 h-[calc(100%+8px)] w-px bg-slate-200" /> : null}
      <span className="relative flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-bold text-slate-500">
        {number}
      </span>
      <div className="pt-0.5">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          {last ? <CheckCircle2 className="size-3.5 text-emerald-600" /> : null}
          {title}
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
      </div>
    </div>
  );
}
