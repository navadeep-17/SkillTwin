import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const links = [
  { href: "/overview", label: "Overview" },
  { href: "/roadmap", label: "Roadmap" },
  { href: "/practice", label: "Practice" },
  { href: "/journey", label: "Journey Chat" },
  { href: "/activity", label: "Activity" }
];

export async function AppNav() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  return (
    <header className="border-b border-slate-200 bg-white/95">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-3">
        <Link href="/overview" className="shrink-0 font-semibold tracking-tight text-slate-950">
          SkillTwin
        </Link>
        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {links.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/onboarding"
          className="hidden shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 sm:block"
        >
          Add evidence
        </Link>
      </div>
    </header>
  );
}
