import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import onet from "@/data/occupations/onet-online-curated-2026-10-13-v1.json";
import canonical from "@/data/occupation-mappings/canonical-skill-snapshot-v2.json";
import mappingDecisions from "@/data/occupation-mappings/review-decisions-v2.json";
import drafts from "@/data/occupation-models/draft-models-v1.json";
import { buildDraftModelSummaries, type DraftModelManifest } from "@/lib/domain/reviewed-career-model";
import { CareerModelBuilder } from "@/components/occupations/career-model-builder";

export const dynamic = "force-dynamic";

/**
 * Learner-safe visibility into source governance; no write endpoints.
 * A DRAFT never joins public.role_versions or becomes an assessed career.
 */
export default async function OccupationModelBuilderPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const models = buildDraftModelSummaries(
    onet, canonical, mappingDecisions,
    drafts as DraftModelManifest
  );

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
      <Link href="/occupations" className="quiet-link">← Occupation Atlas</Link>
      <CareerModelBuilder
        models={models}
        sourceSnapshotId={onet.snapshotId}
        catalogSnapshotId={canonical.snapshotId}
      />
    </main>
  );
}
