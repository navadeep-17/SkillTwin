import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import occupationSnapshot from "@/data/occupations/onet-online-curated-2026-10-13-v1.json";
import canonicalSnapshot from "@/data/occupation-mappings/canonical-skill-snapshot-v1.json";
import reviewManifest from "@/data/occupation-mappings/review-decisions-v1.json";
import { buildMappingReviewQueue, validateMappingReviewManifest } from "@/lib/domain/occupation-mapping";
import { MappingReviewQueue } from "@/components/occupations/mapping-review-queue";

export const dynamic = "force-dynamic";

export default async function OccupationMappingStatusPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const errors = validateMappingReviewManifest(occupationSnapshot, canonicalSnapshot, reviewManifest);
  if (errors.length) throw new Error("Occupation mapping ledger is inconsistent with source snapshots");
  const queue = buildMappingReviewQueue(occupationSnapshot, canonicalSnapshot, reviewManifest);

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
      <Link href="/occupations" className="quiet-link">← Back to Occupation Atlas</Link>
      <header className="mt-6 max-w-3xl">
        <p className="eyebrow">SkillTwin · Transparent data governance</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Occupational skill mapping review</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Every O*NET skill must be reviewed before SkillTwin may link it to its own canonical skill taxonomy.
          Similar wording is not proof of equal competency. This page reports the reviewed ledger; it does not grant review permissions.
        </p>
      </header>
      <MappingReviewQueue queue={queue} catalogSkills={canonicalSnapshot.skills} />
      <section className="mt-7 rounded-xl border border-slate-200 bg-white p-5 text-xs leading-6 text-slate-600">
        <p className="font-semibold text-slate-900">How the review is governed</p>
        <p className="mt-2">
          Candidates are deterministic suggestions. A maintainer may approve, reject, or mark a skill as requiring a new canonical competency,
          with a documented rationale and reviewer identity. Decisions are committed to a versioned GitHub ledger and checked by CI.
          Approvals do not create active role models, readiness scores, assessment questions, or career recommendations.
        </p>
        <p className="mt-2">
          Source: O*NET OnLine, USDOL/ETA, CC BY 4.0. This selected US-context occupational snapshot is not endorsed by USDOL/ETA.
        </p>
        <p className="mt-2">
          <Link className="font-semibold text-brand-700 underline" href="https://github.com/navadeep-17/SkillTwin/blob/main/docs/SKILL_MAPPING_REVIEW.md">
            Review instructions and decision policy ↗
          </Link>
        </p>
      </section>
    </main>
  );
}
