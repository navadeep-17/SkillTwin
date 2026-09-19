import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChallengeLauncher } from "@/components/practice/challenge-launcher";

export default async function PracticePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">Practice</p>
        <h1 className="mt-2 text-3xl font-semibold">Challenge Me</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Validate a high-value uncertain skill. Question-level results stay local to the challenge; SkillTwin changes only after the completed assessment is committed as evidence.
        </p>
      </header>

      <ChallengeLauncher />
    </main>
  );
}
