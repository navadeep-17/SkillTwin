import { redirect } from "next/navigation";
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

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">Agent Activity</p>
        <h1 className="mt-2 text-3xl font-semibold">Observable SkillTwin actions</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          This feed shows committed triggers, changes, references, and impact. It is an audit trail—not hidden model reasoning.
        </p>
      </header>

      <div className="mt-8 space-y-4">
        {events?.length ? events.map(event => (
          <article key={event.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{event.event_type}</p>
                <p className="mt-2 font-medium">{event.summary}</p>
              </div>
              <time className="text-xs text-slate-500">{new Date(event.created_at).toLocaleString()}</time>
            </div>

            <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
              {event.trigger_type ? <span>Trigger: {event.trigger_type}</span> : null}
              {Array.isArray(event.entity_refs) ? <span>{event.entity_refs.length} entity refs</span> : null}
              {Array.isArray(event.evidence_refs) ? <span>{event.evidence_refs.length} evidence refs</span> : null}
            </div>
          </article>
        )) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            No committed agent events yet.
          </div>
        )}
      </div>
    </main>
  );
}
