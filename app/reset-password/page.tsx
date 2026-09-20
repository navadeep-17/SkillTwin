import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?error=Open%20the%20password%20reset%20link%20from%20your%20email.");

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-12">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">SkillTwin</p>
        <h1 className="mt-2 text-2xl font-semibold">Choose a new password</h1>
        <p className="mt-2 text-sm text-slate-600">Your reset link is verified. Set a new password to continue.</p>
        <div className="mt-6"><ResetPasswordForm /></div>
      </div>
    </main>
  );
}
