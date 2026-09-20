import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LearningSettingsForm } from "@/components/settings/learning-settings-form";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data, error } = await supabase
    .from("user_learning_settings")
    .select("notifications_enabled,weekly_report_enabled,reduced_motion,compact_density")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error) throw error;

  return (
    <main className="mx-auto max-w-4xl px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="mb-7 max-w-2xl">
        <p className="eyebrow">Settings</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.025em] text-slate-950">Personalize SkillTwin</h1>
        <p className="mt-3 text-[15px] leading-7 text-slate-600">
          Control presentation and summary preferences without changing the evidence-backed learner model.
        </p>
      </header>

      <LearningSettingsForm
        initial={data ?? {
          notifications_enabled: true,
          weekly_report_enabled: true,
          reduced_motion: false,
          compact_density: false
        }}
      />
    </main>
  );
}
