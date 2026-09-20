import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthForm } from "@/components/auth/auth-form";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect("/onboarding");

  const params = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-12">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">SkillTwin</p>
        <h1 className="mt-2 text-2xl font-semibold">Sign in to build your SkillTwin</h1>
        <p className="mt-2 text-sm text-slate-600">
          Create an account, verify your email, then continue into your persistent learner profile.
        </p>
        <div className="mt-6">
          <AuthForm initialMessage={params.error ?? ""} />
        </div>
      </div>
    </main>
  );
}
