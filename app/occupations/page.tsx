import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import snapshot from "@/data/occupations/onet-online-curated-2026-10-13-v1.json";
import { OccupationAtlas } from "@/components/occupations/occupation-atlas";

export const dynamic = "force-dynamic";

/**
 * Exploratory reference catalog, entirely separate from trusted role models,
 * gap snapshots, assessment banks and career-goal creation.
 */
export default async function OccupationsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
      <OccupationAtlas snapshot={snapshot} />
    </main>
  );
}
