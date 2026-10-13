import { redirect } from "next/navigation";
import { isOrbitDefaultEnabled } from "@/lib/runtime/orbit-default";
import { createClient } from "@/lib/supabase/server";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const orbitDefault = isOrbitDefaultEnabled();
  if (data.user) redirect(orbitDefault ? "/orbit-beta" : "/onboarding");

  const params = await searchParams;
  const nextPath = params.next?.startsWith("/") && !params.next.startsWith("//")
    ? params.next
    : orbitDefault ? "/orbit-beta" : "/onboarding";

  return (
    <AuthShell
      eyebrow="Your learning state, remembered"
      title="Welcome to SkillTwin"
      description="Sign in to continue your persistent learner profile, target-role analysis, and adaptive roadmap."
    >
      <AuthForm initialMessage={params.error ?? ""} nextPath={nextPath} orbitDefault={orbitDefault} />
    </AuthShell>
  );
}
