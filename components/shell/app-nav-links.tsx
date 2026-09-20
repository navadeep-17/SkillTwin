"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  FolderKanban,
  Home,
  Map,
  MessageSquareText,
  Network,
  Sparkles,
  TrendingUp
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const primaryLinks: NavLink[] = [
  { href: "/overview", label: "Home", icon: Home },
  { href: "/skills", label: "Skills", icon: Network },
  { href: "/roadmap", label: "Plan", icon: Map },
  { href: "/practice", label: "Practice", icon: Sparkles },
  { href: "/progress", label: "Progress", icon: TrendingUp }
];

const secondaryLinks: NavLink[] = [
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/journey", label: "Ask SkillTwin", icon: MessageSquareText },
  { href: "/activity", label: "Activity", icon: Activity }
];

function active(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppNavLinks() {
  const pathname = usePathname();

  return (
    <>
      <nav className="mt-6 space-y-1">
        {primaryLinks.map(link => (
          <NavItem key={link.href} link={link} isActive={active(pathname, link.href)} />
        ))}
      </nav>

      <div className="my-5 h-px bg-slate-200/80" />

      <nav className="space-y-1">
        {secondaryLinks.map(link => (
          <NavItem key={link.href} link={link} isActive={active(pathname, link.href)} />
        ))}
      </nav>
    </>
  );
}

export function MobileNavLinks() {
  const pathname = usePathname();

  return (
    <nav className="grid grid-cols-5">
      {primaryLinks.map(link => {
        const Icon = link.icon;
        const isActive = active(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={
              "flex flex-col items-center gap-1 px-1 py-2 text-[11px] font-medium transition-colors " +
              (isActive ? "text-brand-600" : "text-slate-500")
            }
          >
            <Icon className="size-4.5" strokeWidth={isActive ? 2.2 : 1.8} />
            <span>{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function NavItem({ link, isActive }: { link: NavLink; isActive: boolean }) {
  const Icon = link.icon;

  return (
    <Link
      href={link.href}
      className={
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 " +
        (isActive
          ? "bg-brand-50 text-brand-700"
          : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-950")
      }
    >
      <span
        className={
          "flex size-8 items-center justify-center rounded-lg transition-colors " +
          (isActive ? "bg-white text-brand-600 shadow-sm" : "text-slate-500 group-hover:text-slate-800")
        }
      >
        <Icon className="size-4.5" strokeWidth={isActive ? 2.2 : 1.8} />
      </span>
      <span>{link.label}</span>
      {isActive ? <span className="ml-auto size-1.5 rounded-full bg-brand-500" /> : null}
    </Link>
  );
}
