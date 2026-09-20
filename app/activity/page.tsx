import { redirect } from "next/navigation";
import { Activity, Database, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function ActivityPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: events, error } = await supabase
    .from("agent_events")
    .select("id,event_type,trigger_type,summary,entity_refs,evidence_refs,metadata,created_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(60);

  if (error) throw error;

  const eventCount = events?.length ?? 0;
  const evidenceLinked = (events ?? []).filter(event => Array.isArray(event.evidence_refs) && event.evidence_refs.length).length;

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="mb-7">
        <p className="eyebrow">Agent Activity</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.025em] text-slate-950">Observable system actions</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-600">
          A durable audit trail of committed triggers and state changes. This shows what happened and why it matters, not hidden model reasoning.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <Metric icon={Activity} label="Recent events" value={String(eventCount)} />
        <Metric icon={Database} label="Evidence-linked" value={String(evidenceLinked)} />
        <Metric icon={ShieldCheck} label="Audit posture" value="Append-only" />
      </section>

      <section className="surface-card mt-6 overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <h2 className="font-semibold text-slate-900">Activity timeline</h2>
          <p className="mt-1 text-xs text-slate-500">Newest committed event first</p>
        </div>

        <div className="px-5 py-2 sm:px-6">
          {events?.length ? events.map((event, index) => (
            <article key={event.id} className="relative flex gap-4 border-b border-slate-100 py-5 last:border-b-0">
              {index < events.length - 1 ? <span className="absolute left-[7px] top-9 h-[calc(100%-16px)] w-px bg-slate-200" /> : null}
              <span className="relative mt-1.5 size-3.5 shrink-0 rounded-full border-[3px] border-white bg-brand-400 shadow-[0_0_0_1px_#E4E7EC]" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-600">
                      {humanize(event.event_type)}
                    </p>
                    <p className="mt-1.5 text-sm font-medium leading-6 text-slate-800">{event.summary}</p>
                  </div>
                  <time className="text-xs text-slate-400">{new Date(event.created_at).toLocaleString()}</time>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                  {event.trigger_type ? (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">
                      Trigger · {humanize(event.trigger_type)}
                    </span>
                  ) : null}
                  {Array.isArray(event.entity_refs) && event.entity_refs.length ? (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">
                      {event.entity_refs.length} entity {event.entity_refs.length === 1 ? "reference" : "references"}
                    </span>
                  ) : null}
                  {Array.isArray(event.evidence_refs) && event.evidence_refs.length ? (
                    <span className="rounded-full bg-brand-50 px-2.5 py-1 text-brand-700">
                      {event.evidence_refs.length} evidence {event.evidence_refs.length === 1 ? "reference" : "references"}
                    </span>
                  ) : null}
                </div>
              </div>
            </article>
          )) : (
            <div className="py-12 text-center">
              <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <Activity className="size-5" />
              </span>
              <p className="mt-4 text-sm font-semibold text-slate-800">No committed activity yet</p>
              <p className="mt-1 text-xs text-slate-500">Evidence ingestion, assessments, and replans will appear here.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Activity;
  label: string;
  value: string;
}) {
  return (
    <div className="surface-card flex items-center gap-3 p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <Icon className="size-4.5" />
      </span>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-0.5 text-lg font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function humanize(value: string) {
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase());
}
