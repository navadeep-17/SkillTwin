import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/settings/settings-form";

export default async function SettingsPage() {
  const supabase=await createClient();
  const {data:auth}=await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const [{data:goal,error:goalError},{data:settings,error:settingsError}] = await Promise.all([
    supabase.from("career_goals").select("*").eq("user_id",auth.user.id).eq("status","ACTIVE").limit(1).maybeSingle(),
    supabase.from("user_learning_settings").select("*").eq("user_id",auth.user.id).maybeSingle()
  ]);
  if (goalError) throw goalError;
  if (settingsError) throw settingsError;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">Settings</p>
      <h1 className="mt-2 text-3xl font-semibold">Learning and adaptation preferences</h1>
      <p className="mt-2 text-slate-600">These settings change planning constraints or presentation. They never rewrite capability evidence.</p>
      <div className="mt-8">
        <SettingsForm goal={goal} settings={settings} />
      </div>
    </main>
  );
}
