import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/auth/logout-button";
import { AppNavLinks, MobileNavLinks } from "@/components/shell/app-nav-links";

export async function AppNav({ userId, email }: { userId: string; email?: string | null }) {
  const supabase = await createClient();

  const [{ data: goal }, { data: snapshot }] = await Promise.all([
    supabase
      .from("career_goals")
      .select("id,role_versions!inner(target_roles!inner(name))")
      .eq("user_id", userId)
      .eq("status", "ACTIVE")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("gap_snapshots")
      .select("readiness,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  const roleVersion = goal?.role_versions as {
    target_roles?: { name?: string } | Array<{ name?: string }>;
  } | null;
  const targetRole = Array.isArray(roleVersion?.target_roles)
    ? roleVersion?.target_roles[0]
    : roleVersion?.target_roles;
  const roleName = targetRole?.name ?? "Choose a target role";
  const readiness = snapshot?.readiness != null ? Number(snapshot.readiness) : null;

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200/80 bg-white/92 px-4 py-5 backdrop-blur-xl lg:flex lg:flex-col">
        <Link href="/overview" className="flex items-center gap-3 px-2">
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand-500 text-sm font-bold text-white shadow-[0_8px_22px_rgba(91,92,226,0.24)]">
            S
          </span>
          <span>
            <span className="block text-[15px] font-semibold tracking-tight text-slate-950">SkillTwin</span>
            <span className="block text-xs text-slate-500">Adaptive learning</span>
          </span>
        </Link>

        <AppNavLinks />

        <div className="mt-auto space-y-3">
          <Link
            href="/onboarding"
            className="block rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 transition hover:border-brand-200 hover:bg-brand-50/50"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Target</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-900">{roleName}</p>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <span>{readiness == null ? "Add evidence" : "Role readiness"}</span>
              <span className="font-semibold text-slate-700">{readiness == null ? "Set up" : Math.round(readiness) + "%"}</span>
            </div>
            {readiness != null ? (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-brand-500 transition-all duration-500" style={{ width: Math.max(2, Math.min(100, readiness)) + "%" }} />
              </div>
            ) : null}
          </Link>

          <div className="flex items-center justify-between gap-2 px-1">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-slate-700">{email ?? "Signed in"}</p>
            </div>
            <LogoutButton />
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Link href="/overview" className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-500 text-xs font-bold text-white">S</span>
          <span className="font-semibold tracking-tight">SkillTwin</span>
        </Link>
        <Link href="/journey" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
          Ask SkillTwin
        </Link>
      </header>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <MobileNavLinks />
      </div>
    </>
  );
}
