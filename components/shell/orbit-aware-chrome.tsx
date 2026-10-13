"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { OrbitSecondaryWorkspace, findOrbitSecondaryWorkspace } from "@/components/orbit/orbit-secondary-workspace";

// The original product sidebar is still used on classic SkillTwin pages.
// Orbit renders its own primary navigation; never stack two nav systems or
// preserve the classic 256px offset on an Orbit page.
export function OrbitAwareChrome({
  signedIn, legacyNavigation, children, orbitDefault = false
}: {
  signedIn: boolean;
  orbitDefault?: boolean;
  legacyNavigation: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const secondary = Boolean(signedIn && orbitDefault && findOrbitSecondaryWorkspace(pathname));
  const orbit = pathname.startsWith("/orbit-") || pathname === "/orbit-lab" || pathname.startsWith("/orbit-lab/") || (orbitDefault && pathname === "/") || secondary;
  return (
    <>
      {signedIn && !orbit ? legacyNavigation : null}
      <div className={signedIn && !orbit ? "min-h-screen pb-20 lg:pb-0 lg:pl-64" : "min-h-screen"}>
        {secondary ? <OrbitSecondaryWorkspace pathname={pathname}>{children}</OrbitSecondaryWorkspace> : children}
      </div>
    </>
  );
}
