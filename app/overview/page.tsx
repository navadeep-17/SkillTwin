import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, ChevronRight, Sparkles, Target, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AnimatedReadinessRing } from "@/components/ui/animated-readiness-ring";

export default async function OverviewPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const [
    { data: skills, error: skillsError },
    { data: snapshot, error: snapshotError },
    { data: activity, error: activityError },
    { data: goal, error: goalError }
  ] = await Promise.all([
    supabase
      .from("user_skills")
      .select("skill_id,level_value,capability_score,confidence,conflict_state,evidence_count,last_validated_at,skills!inner(slug,canonical_name,category)")
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
      .from("agent_events")
      .select("id,event_type,summary,created_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("career_goals")
      .select("id,target_date,role_versions!inner(version,target_roles!inner(name,slug,family))")
      .eq("user_id", auth.user.id)
      .eq("status", "ACTIVE")
      .limit(1)
      .maybeSingle()
  ]);

  if (skillsError) throw skillsError;
  if (snapshotError) throw snapshotError;
  if (activityError) throw activityError;
  if (goalError) throw goalError;

  const roleVersion = goal?.role_versions as {
    version?: number;
    target_roles?: { name?: string; slug?: string; family?: string | null } | Array<{ name?: string; slug?: string; family?: string | null }>;
  } | null;
  const targetRole = Array.isArray(roleVersion?.target_roles)
    ? roleVersion?.target_roles[0]
    : roleVersion?.target_roles;
  const roleName = targetRole?.name ?? "Target role";
  const roleVersionNumber = roleVersion?.version ?? 1;

  let gaps: Array<Record<string, unknown>> = [];
  if (snapshot?.id) {
    const { data, error } = await supabase
      .from("skill_gap_results")
      .select("id,skill_id,current_score,current_confidence,target_score,gap_severity,priority_score,priority_band,status,recommended_action,reason_codes,skills!inner(slug,canonical_name,category)")
      .eq("snapshot_id", snapshot.id)
      .order("priority_score", { ascending: false })
      .limit(5);
    if (error) throw error;
    gaps = data ?? [];
  }

  if (!skills?.length && !snapshot) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-10 sm:px-6 lg:px-8 lg:py-14">
        <section className="surface-card hero-wash relative overflow-hidden p-7 sm:p-10">
          <div className="relative max-w-2xl">
            <p className="eyebrow">Your SkillTwin</p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Give SkillTwin something real to learn from.
            </h1>
            <p className="mt-4 text-[15px] leading-7 text-slate-600">
              Choose a target role and add your resume or project evidence. We will build an evidence-backed skill state, compare it with your goal, and turn the gaps into an adaptive plan.
            </p>
            <Link href="/onboarding" className="btn-primary mt-7">
              Build my SkillTwin <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const readiness = Math.max(0, Math.min(100, Number(snapshot?.readiness ?? 0)));
  const coverage = Math.max(0, Math.min(100, Number(snapshot?.evidence_coverage ?? 0)));
  const strongSkills = (skills ?? []).filter(skill => skill.level_value !== "UNKNOWN").length;
  const avgConfidence = skills?.length
    ? Math.round(100 * skills.reduce((sum, skill) => sum + Number(skill.confidence ?? 0), 0) / skills.length)
    : 0;
  const topGap = gaps[0];
  const topGapSkill = topGap?.skills as { canonical_name?: string; category?: string } | null;
  const displayName = String(auth.user.user_metadata?.full_name ?? auth.user.email?.split("@")[0] ?? "there").split(" ")[0];

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{roleName} · SkillTwin live</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            Welcome back, {displayName}
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">Here is what matters in your learning journey right now.</p>
        </div>
        <Link href="/onboarding" className="btn-secondary">
          Add evidence
        </Link>
      </header>

      <section className="surface-card hero-wash relative overflow-hidden p-6 sm:p-8">
        <div className="relative grid items-center gap-8 lg:grid-cols-[1.3fr_.7fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50/80 px-3 py-1.5 text-xs font-semibold text-brand-700">
              <Sparkles className="size-3.5" />
              Your adaptive learning state
            </div>
            <h2 className="mt-5 max-w-2xl text-3xl font-semibold tracking-[-0.025em] text-slate-950 sm:text-4xl">
              You are {Math.round(readiness)}% ready for {roleName}.
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-600">
              {topGapSkill?.canonical_name
                ? "Your highest-impact focus is " + topGapSkill.canonical_name + ". SkillTwin will keep validating your evidence and adjust only the work that needs to change."
                : "SkillTwin is using your evidence to keep your plan aligned with your target role."}
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/roadmap" className="btn-primary">
                Continue my plan <ArrowRight className="size-4" />
              </Link>
              <Link href="/practice" className="btn-secondary">
                Challenge me
              </Link>
            </div>

            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-emerald-600" />
                {strongSkills} skills backed by evidence
              </span>
              <span>Role model v{roleVersionNumber}</span>
              {goal?.target_date ? <span>Target {new Date(goal.target_date).toLocaleDateString()}</span> : null}
            </div>
          </div>

          <div className="flex items-center justify-center lg:justify-end">
            <AnimatedReadinessRing value={readiness} />
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-4 sm:grid-cols-3">
        <Metric
          icon={Target}
          label="Evidence coverage"
          value={Math.round(coverage) + "%"}
          detail="How much of the role is backed by evidence"
        />
        <Metric
          icon={TrendingUp}
          label="Average confidence"
          value={avgConfidence + "%"}
          detail="Certainty is tracked separately from capability"
        />
        <Metric
          icon={Sparkles}
          label="Skills observed"
          value={String(skills?.length ?? 0)}
          detail={strongSkills + " currently have usable evidence"}
        />
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <div className="surface-card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Next focus</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight">Highest-impact skill gaps</h2>
            </div>
            <Link href="/skills" className="quiet-link inline-flex items-center gap-1">
              Explore skills <ChevronRight className="size-4" />
            </Link>
          </div>

          <div className="mt-5 divide-y divide-slate-100">
            {gaps.length ? gaps.map((gap, index) => {
              const skill = gap.skills as { canonical_name?: string; category?: string } | null;
              const band = String(gap.priority_band ?? "");
              const gapPercent = Math.round(Number(gap.gap_severity) * 100);
              return (
                <div key={String(gap.id)} className="group flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-semibold text-slate-500">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">{skill?.canonical_name ?? "Skill"}</p>
                      <PriorityBadge band={band} />
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {humanize(String(gap.recommended_action ?? "LEARN"))} · {gapPercent}% gap
                    </p>
                  </div>
                  <div className="hidden w-28 sm:block">
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="progress-fill h-full rounded-full bg-brand-400" style={{ width: Math.max(4, Math.min(100, gapPercent)) + "%" }} />
                    </div>
                  </div>
                  <ChevronRight className="size-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500" />
                </div>
              );
            }) : (
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                No active gap snapshot yet. Add evidence to refresh your role analysis.
              </div>
            )}
          </div>
        </div>

        <div className="surface-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Recent activity</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight">What SkillTwin changed</h2>
            </div>
            <Link href="/activity" className="quiet-link">View all</Link>
          </div>

          <div className="mt-5 space-y-0">
            {activity?.length ? activity.map((event, index) => (
              <div key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
                {index < activity.length - 1 ? <span className="absolute left-[7px] top-4 h-full w-px bg-slate-200" /> : null}
                <span className="relative mt-1.5 size-3.5 shrink-0 rounded-full border-[3px] border-white bg-brand-400 shadow-[0_0_0_1px_#E4E7EC]" />
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-5 text-slate-800">{event.summary}</p>
                  <p className="mt-1 text-xs text-slate-400">{new Date(event.created_at).toLocaleString()}</p>
                </div>
              </div>
            )) : (
              <p className="text-sm text-slate-500">Your SkillTwin activity will appear here.</p>
            )}
          </div>
        </div>
      </section>

      <section className="surface-card mt-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Your SkillTwin</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">Capability and confidence</h2>
          </div>
          <Link href="/skills" className="quiet-link inline-flex items-center gap-1">
            Open skill graph <ChevronRight className="size-4" />
          </Link>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(skills ?? []).slice(0, 9).map(skill => {
            const meta = skill.skills as { canonical_name?: string; category?: string } | null;
            const confidence = Math.round(Number(skill.confidence ?? 0) * 100);
            return (
              <div key={skill.skill_id} className="rounded-xl border border-slate-200/80 bg-white p-4 transition duration-200 hover:-translate-y-px hover:border-slate-300 hover:shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{meta?.canonical_name ?? "Skill"}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-400">{meta?.category ?? ""}</p>
                  </div>
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                    {humanize(String(skill.level_value))}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Confidence</span>
                  <span className="font-semibold text-slate-700">{confidence}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-slate-400 transition-all duration-500" style={{ width: Math.max(2, confidence) + "%" }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail
}: {
  icon: typeof Target;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="surface-card p-5 transition duration-200 hover:-translate-y-px hover:shadow-lift">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
        </div>
        <span className="flex size-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Icon className="size-4.5" />
        </span>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function PriorityBadge({ band }: { band: string }) {
  const styles =
    band === "CRITICAL"
      ? "bg-rose-50 text-rose-700 ring-rose-100"
      : band === "HIGH"
        ? "bg-amber-50 text-amber-700 ring-amber-100"
        : "bg-slate-50 text-slate-600 ring-slate-100";

  return (
    <span className={"rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 " + styles}>
      {band || "Priority"}
    </span>
  );
}

function humanize(value: string) {
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase());
}
