"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// The original product sidebar is still used on classic SkillTwin pages.
// Orbit renders its own primary navigation; never stack two nav systems or
// preserve the classic 256px offset on an Orbit page.
export function OrbitAwareChrome({
  signedIn, legacyNavigation, children
}: {
  signedIn: boolean;
  legacyNavigation: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const orbit = pathname.startsWith("/orbit-") || pathname === "/orbit-lab" || pathname.startsWith("/orbit-lab/");
  return (
    <>
      {signedIn && !orbit ? legacyNavigation : null}
      <div className={signedIn && !orbit ? "min-h-screen pb-20 lg:pb-0 lg:pl-64" : "min-h-screen"}>
        {children}
      </div>
    </>
  );
}
