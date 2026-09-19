import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { JourneyChat } from "@/components/journey/journey-chat";

export default async function JourneyPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">Journey Chat</p>
        <h1 className="mt-2 text-3xl font-semibold">Ask about your learning journey</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Answers are grounded in your current SkillTwin, gaps, roadmap, assessment history, and PlanDiffs. Chat is read-only unless you explicitly confirm a proposed action.
        </p>
      </header>
      <div className="mt-8">
        <JourneyChat />
      </div>
    </main>
  );
}
