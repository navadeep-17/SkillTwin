import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default async function ForgotPasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect("/overview");

  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Reset your password"
      description="We will send a secure recovery link to the email connected to your SkillTwin."
    >
      <ForgotPasswordForm />
      <Link href="/login" className="quiet-link mt-5 inline-flex items-center gap-1.5">
        <ArrowLeft className="size-4" />
        Back to sign in
      </Link>
    </AuthShell>
  );
}
