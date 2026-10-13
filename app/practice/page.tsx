import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChallengeLauncher } from "@/components/practice/challenge-launcher";
import { ResumeChallenges } from "@/components/practice/resume-challenges";

export default async function PracticePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  // Read-only, account-scoped recovery for unfinished challenges. A browser
  // refresh must never force a learner to abandon already committed answers.
  const { data: activeChallenges, error } = await supabase
    .from("skill_assessments")
    .select("id,created_at,current_question_index,skills!inner(canonical_name)")
    .eq("user_id",data.user.id)
    .eq("status","ACTIVE")
    .order("created_at",{ascending:false})
    .limit(8);
  if (error) throw error;

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="mb-7 max-w-3xl">
        <p className="eyebrow">Practice</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.025em] text-slate-950">Challenge Me</h1>
        <p className="mt-3 text-[15px] leading-7 text-slate-600">
          Validate a high-value uncertain skill. Question-level scoring stays inside the challenge; your SkillTwin changes only after the completed assessment is committed as evidence.
        </p>
      </header>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-100 bg-brand-50/50 p-4">
        <p className="text-sm text-slate-700">Think your Twin's estimate is wrong? Inspect the evidence and challenge a particular skill.</p>
        <Link href="/challenge-my-twin" className="btn-secondary">Challenge My Twin →</Link>
      </div>
      <ResumeChallenges challenges={(activeChallenges ?? []).map(challenge => {
        const skill = Array.isArray(challenge.skills) ? challenge.skills[0] : challenge.skills;
        return {
          id: String(challenge.id),
          name: String(skill?.canonical_name ?? "Skill challenge"),
          answered: Math.max(0,Number(challenge.current_question_index ?? 0)),
          createdAt: String(challenge.created_at)
        };
      })} />
      <ChallengeLauncher />
    </main>
  );
}
