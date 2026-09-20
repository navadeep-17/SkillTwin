import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?error=Open%20the%20password%20reset%20link%20from%20your%20email.");

  return (
    <AuthShell
      eyebrow="Secure recovery"
      title="Choose a new password"
      description="Your recovery link is verified. Set a new password and continue into your SkillTwin."
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
