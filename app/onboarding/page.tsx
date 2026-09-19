import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const [
    { data: roles, error: roleError },
    { data: goal, error: goalError },
    { data: profile, error: profileError }
  ] = await Promise.all([
    supabase
      .from("target_roles")
      .select("id,slug,name,family,role_versions!inner(id,version,source,status)")
      .eq("role_versions.status","ACTIVE")
      .order("family")
      .order("name"),
    supabase
      .from("career_goals")
      .select("*")
      .eq("user_id",auth.user.id)
      .eq("status","ACTIVE")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("users")
      .select("display_name,onboarding_step,onboarding_completed_at")
      .eq("id",auth.user.id)
      .single()
  ]);

  if (roleError) throw roleError;
  if (goalError) throw goalError;
  if (profileError) throw profileError;

  const roleOptions=(roles ?? []).flatMap(role => {
    const versions=Array.isArray(role.role_versions) ? role.role_versions : [role.role_versions];
    return versions.filter(Boolean).map(version => ({
      id:role.id,
      slug:role.slug,
      name:role.name,
      family:role.family,
      roleVersionId:(version as {id:string}).id,
      source:(version as {source:string}).source
    }));
  });

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <OnboardingFlow
        roles={roleOptions}
        initialGoal={goal}
        displayName={profile?.display_name ?? ""}
        initialStep={Math.max(1,Math.min(4,Number(profile?.onboarding_step ?? 0)+1))}
      />
    </main>
  );
}
