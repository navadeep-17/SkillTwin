import { redirect } from "next/navigation";
import { MessageSquareText, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { JourneyChat } from "@/components/journey/journey-chat";

export default async function JourneyPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="mb-7 flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-2xl">
          <p className="eyebrow">Ask SkillTwin</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.025em] text-slate-950">
            Understand your learning journey.
          </h1>
          <p className="mt-3 text-[15px] leading-7 text-slate-600">
            Ask what to focus on, why a skill matters, what changed in your plan, or how your readiness was calculated.
          </p>
        </div>
        <div className="surface-card flex max-w-sm items-start gap-3 p-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <ShieldCheck className="size-4.5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-800">Grounded, not autonomous</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Read-only by default. Any action is previewed and requires confirmation.
            </p>
          </div>
        </div>
      </header>

      <div className="fade-up">
        <JourneyChat />
      </div>
    </main>
  );
}
