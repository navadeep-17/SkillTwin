import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">Onboarding</p>
      <h1 className="mt-2 text-3xl font-semibold">Build your real SkillTwin</h1>
      <p className="mt-3 max-w-3xl text-slate-600">
        Choose your target role and learning capacity, then add profile evidence. SkillTwin will preserve provenance,
        estimate capability and confidence, compute role gaps, and generate a persistent roadmap from your actual state.
      </p>
      <div className="mt-8">
        <OnboardingFlow />
      </div>
    </main>
  );
}
