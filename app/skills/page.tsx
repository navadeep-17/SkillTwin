import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type GapRow = {
  skill_id: string;
  target_score: number;
  gap_severity: number;
  priority_score: number;
  priority_band: string;
  recommended_action: string;
};

export default async function SkillsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const [
    { data: userSkills, error: skillsError },
    { data: snapshot, error: snapshotError },
    { data: evidence, error: evidenceError }
  ] = await Promise.all([
    supabase
      .from("user_skills")
      .select("skill_id,level_value,capability_score,confidence,conflict_state,evidence_count,source_family_count,last_evidence_at,last_validated_at,skills!inner(slug,canonical_name,category,description)")
      .eq("user_id", auth.user.id)
      .order("confidence", { ascending: false }),
    supabase
      .from("gap_snapshots")
      .select("id,readiness,evidence_coverage,created_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("skill_evidence")
      .select("id,skill_id,source_type,claim,level_signal,effective_weight,status,metadata,created_at")
      .eq("user_id", auth.user.id)
      .in("status", ["ACCEPTED","NON_AGGREGATING"])
      .order("created_at", { ascending: false })
      .limit(120)
  ]);

  if (skillsError) throw skillsError;
  if (snapshotError) throw snapshotError;
  if (evidenceError) throw evidenceError;

  let gaps: GapRow[] = [];
  if (snapshot?.id) {
    const { data, error } = await supabase
      .from("skill_gap_results")
      .select("skill_id,target_score,gap_severity,priority_score,priority_band,recommended_action")
      .eq("snapshot_id", snapshot.id);
    if (error) throw error;
    gaps = (data ?? []) as GapRow[];
  }

  const gapMap = new Map(gaps.map(gap => [gap.skill_id, gap]));
  const evidenceMap = new Map<string, typeof evidence>();
  for (const item of evidence ?? []) {
    const current = evidenceMap.get(item.skill_id) ?? [];
    current.push(item);
    evidenceMap.set(item.skill_id, current);
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">Skill Matrix</p>
        <h1 className="mt-2 text-3xl font-semibold">Evidence-backed learner state</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Capability, confidence, role target, and priority are separate signals. Expand a skill to inspect the evidence that produced the current SkillTwin estimate.
        </p>
      </header>

      {!userSkills?.length ? (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          No skill state exists yet. Analyze your resume first.
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {userSkills.map(skill => {
            const meta = skill.skills as { canonical_name?: string; category?: string; description?: string; slug?: string } | null;
            const gap = gapMap.get(skill.skill_id);
            const items = evidenceMap.get(skill.skill_id) ?? [];
            const confidence = Math.round(Number(skill.confidence) * 100);
            const gapPercent = gap ? Math.round(Number(gap.gap_severity) * 100) : null;

            return (
              <details key={skill.skill_id} className="group rounded-2xl border border-slate-200 bg-white shadow-sm">
                <summary className="cursor-pointer list-none p-5">
                  <div className="grid gap-4 md:grid-cols-[1.3fr_.7fr_.7fr_.7fr] md:items-center">
                    <div>
                      <p className="font-semibold">{meta?.canonical_name ?? "Skill"}</p>
                      <p className="mt-1 text-sm text-slate-500">{meta?.category ?? ""}</p>
                    </div>
                    <Mini label="Capability" value={String(skill.level_value)} />
                    <Mini label="Confidence" value={confidence + "%"} />
                    <Mini
                      label="Role gap"
                      value={gapPercent == null ? "—" : gapPercent + "%"}
                    />
                  </div>
                </summary>

                <div className="border-t border-slate-200 p-5">
                  <div className="grid gap-4 md:grid-cols-4">
                    <Metric label="Capability score" value={skill.capability_score == null ? "Unknown" : Number(skill.capability_score).toFixed(2) + " / 4"} />
                    <Metric label="Target score" value={gap ? Number(gap.target_score).toFixed(2) + " / 4" : "—"} />
                    <Metric label="Priority" value={gap ? String(gap.priority_band) : "—"} />
                    <Metric label="Next action" value={gap ? String(gap.recommended_action) : "—"} />
                  </div>

                  <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.5fr]">
                    <div>
                      <h2 className="font-semibold">Why it matters</h2>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {meta?.description ?? "This skill contributes to the target-role competency model."}
                      </p>
                      <div className="mt-4 space-y-1 text-sm text-slate-500">
                        <p>{skill.evidence_count} evidence items across {skill.source_family_count} source families</p>
                        <p>Conflict: {skill.conflict_state}</p>
                        <p>Last validated: {skill.last_validated_at ? new Date(skill.last_validated_at).toLocaleDateString() : "Not yet"}</p>
                      </div>
                    </div>

                    <div>
                      <h2 className="font-semibold">Evidence found</h2>
                      <div className="mt-3 space-y-2">
                        {items.length ? items.slice(0, 8).map(item => (
                          <div key={item.id} className="rounded-xl bg-slate-50 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs font-semibold uppercase tracking-wide text-brand-600">{item.source_type}</span>
                              <span className="text-xs text-slate-500">Weight {Number(item.effective_weight).toFixed(2)}</span>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-slate-700">{item.claim}</p>
                          </div>
                        )) : (
                          <p className="text-sm text-slate-500">No evidence rows available.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </main>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
