"use client";

import Link from "next/link";
import "./orbit-preview-nav-extra.css";
import { usePathname } from "next/navigation";
import { BrainCircuit, Compass, Fingerprint, House, Route, Sparkles, ChevronDown, Award, MessageSquareText, Settings2, ArrowLeft } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";

const items = [
  { href: "/orbit-beta", label: "Today", icon: House, orbit: true },
  { href: "/orbit-skills", label: "My Twin", icon: BrainCircuit, orbit: true },
  { href: "/orbit-journey", label: "Journey", icon: Route, orbit: true },
  { href: "/orbit-prove", label: "Prove", icon: Fingerprint, orbit: true },
  { href: "/orbit-explore", label: "Explore", icon: Compass, orbit: true }
] as const;

export function OrbitPreviewNav() {
  const pathname = usePathname();
  return (
    <div className="orbit-preview-nav-wrap">
      <Link className="orbit-preview-brand" href="/orbit-beta" aria-label="SkillTwin Orbit Today">
        <span className="orbit-preview-brand-mark"><Sparkles size={17}/></span>
        <span>SkillTwin<span className="orbit-preview-brand-accent">.</span> <small>ORBIT</small></span>
      </Link>
      <nav className="orbit-preview-nav" aria-label="Career learning navigation">
        {items.map(item => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href}
              aria-current={active?"page":undefined}
              aria-label={item.orbit?item.label:item.label+" (current SkillTwin screen)"}
              className={"orbit-preview-nav-link" + (active?" active":"")}>
              <Icon size={16} aria-hidden="true"/>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="orbit-preview-actions">
        <details className="orbit-preview-more">
          <summary>More <ChevronDown size={14} aria-hidden="true"/></summary>
          <div className="orbit-preview-menu">
            <Link href="/certifications"><Award size={16}/> Certifications</Link>
            <Link href="/certifications/journey"><Award size={16}/> My certification journey</Link>
            <Link href="/journey"><MessageSquareText size={16}/> Ask SkillTwin</Link>
            <Link href="/settings"><Settings2 size={16}/> Settings</Link>
            <Link href="/overview"><ArrowLeft size={16}/> Classic interface</Link>
            <LogoutButton/>
          </div>
        </details>
      </div>
      <Link className={"orbit-preview-build" + (pathname==="/orbit-onboarding"?" active":"")}
        href="/orbit-onboarding" aria-current={pathname==="/orbit-onboarding"?"page":undefined}>
        Build my Twin
      </Link>
    </div>
  );
}
