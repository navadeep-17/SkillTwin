import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default async function ForgotPasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect("/overview");

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-12">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">SkillTwin</p>
        <h1 className="mt-2 text-2xl font-semibold">Reset your password</h1>
        <p className="mt-2 text-sm text-slate-600">We will email you a secure link to choose a new password.</p>
        <div className="mt-6"><ForgotPasswordForm /></div>
        <Link href="/login" className="mt-5 inline-block text-sm font-medium text-brand-700">Back to sign in</Link>
      </div>
    </main>
  );
}
