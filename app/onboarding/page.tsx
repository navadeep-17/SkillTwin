import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResumeAnalyzer } from "@/components/onboarding/resume-analyzer";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">Step 1 · Profile evidence</p>
      <h1 className="mt-2 text-3xl font-semibold">Build your first SkillTwin</h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        Upload a text-based PDF resume. SkillTwin will preserve source provenance, map evidence to canonical skills, estimate capability/confidence, and compare the result against Backend Engineer v1.
      </p>
      <div className="mt-8">
        <ResumeAnalyzer />
      </div>
    </main>
  );
}
