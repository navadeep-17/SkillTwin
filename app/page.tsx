import OrbitMarketingHome from "@/components/landing/orbit-marketing-home";
import ClassicHome from "@/components/landing/classic-home";
import { isOrbitDefaultEnabled } from "@/lib/runtime/orbit-default";

// The default is controlled by Railway's RUNNING environment, not an env
// value frozen into the browser bundle at build time. Keep the previous
// marketing page as a reversible fallback when the flag is disabled.
export const dynamic = "force-dynamic";

export default function HomePage() {
  return isOrbitDefaultEnabled() ? <OrbitMarketingHome /> : <ClassicHome />;
}
