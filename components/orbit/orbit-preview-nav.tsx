"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrainCircuit, Compass, Fingerprint, House, Route, Sparkles } from "lucide-react";

const items = [
  { href: "/orbit-beta", label: "Today", icon: House, orbit: true },
  { href: "/skills", label: "My Twin", icon: BrainCircuit, orbit: false },
  { href: "/roadmap", label: "Journey", icon: Route, orbit: false },
  { href: "/challenge-my-twin", label: "Prove", icon: Fingerprint, orbit: false },
  { href: "/discover", label: "Explore", icon: Compass, orbit: false }
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
      <Link className={"orbit-preview-build" + (pathname==="/orbit-onboarding"?" active":"")}
        href="/orbit-onboarding" aria-current={pathname==="/orbit-onboarding"?"page":undefined}>
        Build my Twin
      </Link>
    </div>
  );
}
