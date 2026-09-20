import { redirect } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="mb-6">
        <Link href="/overview" className="quiet-link inline-flex items-center gap-1.5">
          <ArrowLeft className="size-4" />
          Back to SkillTwin
        </Link>
      </div>

      <header className="mb-8 max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50/80 px-3 py-1.5 text-xs font-semibold text-brand-700">
          <Sparkles className="size-3.5" />
          Personalize your learning state
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.025em] text-slate-950 sm:text-4xl">
          Build a SkillTwin that actually represents you.
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-600">
          Set your target and learning constraints, then add evidence. SkillTwin keeps capability, confidence,
          gaps, and your roadmap grounded in persisted learner state instead of one-shot generation.
        </p>
      </header>

      <div className="fade-up">
        <OnboardingFlow />
      </div>
    </main>
  );
}
