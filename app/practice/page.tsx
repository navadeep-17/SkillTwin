import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChallengeLauncher } from "@/components/practice/challenge-launcher";

export default async function PracticePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="mb-7 max-w-3xl">
        <p className="eyebrow">Practice</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.025em] text-slate-950">Challenge Me</h1>
        <p className="mt-3 text-[15px] leading-7 text-slate-600">
          Validate a high-value uncertain skill. Question-level scoring stays inside the challenge; your SkillTwin changes only after the completed assessment is committed as evidence.
        </p>
      </header>

      <ChallengeLauncher />
    </main>
  );
}
