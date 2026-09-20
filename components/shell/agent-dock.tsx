"use client";

import { useEffect, useState } from "react";
import { JourneyChat } from "@/components/journey/journey-chat";

type EventRow = {
  id: string;
  event_type: string;
  trigger_type: string | null;
  summary: string;
  created_at: string;
};

export function AgentDock() {
  const [panel, setPanel] = useState<"chat" | "activity" | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  useEffect(() => {
    if (panel !== "activity") return;
    let cancelled = false;

    async function load() {
      setLoadingEvents(true);
      try {
        const response = await fetch("/api/agent-events?limit=20", { cache: "no-store" });
        const payload = await response.json();
        if (!cancelled && response.ok && payload.ok) {
          setEvents(payload.data.events ?? []);
        }
      } finally {
        if (!cancelled) setLoadingEvents(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [panel]);

  return (
    <>
      <div className="fixed bottom-5 right-5 z-40 flex gap-2">
        <button
          type="button"
          onClick={() => setPanel(current => current === "activity" ? null : "activity")}
          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-lg hover:bg-slate-50"
        >
          Activity
        </button>
        <button
          type="button"
          onClick={() => setPanel(current => current === "chat" ? null : "chat")}
          className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-brand-700"
        >
          Ask SkillTwin
        </button>
      </div>

      {panel ? (
        <div className="fixed inset-0 z-50 bg-slate-950/20" onClick={() => setPanel(null)}>
          <aside
            className="absolute bottom-0 right-0 top-0 w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-slate-50 p-4 shadow-2xl sm:p-5"
            onClick={event => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
                  {panel === "chat" ? "Journey Chat" : "Agent Activity"}
                </p>
                <h2 className="mt-1 text-xl font-semibold">
                  {panel === "chat" ? "Ask your current SkillTwin" : "Committed agent actions"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPanel(null)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600"
              >
                Close
              </button>
            </div>

            {panel === "chat" ? (
              <JourneyChat />
            ) : (
              <div className="space-y-3">
                {loadingEvents ? (
                  <p className="rounded-xl bg-white p-4 text-sm text-slate-500">Loading activity…</p>
                ) : events.length ? (
                  events.map(event => (
                    <article key={event.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                          {event.event_type}
                        </p>
                        <time className="text-[11px] text-slate-400">
                          {new Date(event.created_at).toLocaleString()}
                        </time>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{event.summary}</p>
                      {event.trigger_type ? (
                        <p className="mt-2 text-xs text-slate-400">Trigger: {event.trigger_type}</p>
                      ) : null}
                    </article>
                  ))
                ) : (
                  <p className="rounded-xl bg-white p-4 text-sm text-slate-500">No committed agent activity yet.</p>
                )}
              </div>
            )}
          </aside>
        </div>
      ) : null}
    </>
  );
}
