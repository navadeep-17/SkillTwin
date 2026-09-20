"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, MessageSquareText, Sparkles, X } from "lucide-react";
import { JourneyChat } from "@/components/journey/journey-chat";

type EventRow = {
  id: string;
  event_type: string;
  trigger_type?: string | null;
  summary: string;
  created_at: string;
};

export function GlobalAssistantDock() {
  const [open, setOpen] = useState<"chat" | "activity" | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open !== "activity") return;
    let active = true;
    setLoadingEvents(true);

    fetch("/api/agent-events?limit=20", { cache: "no-store" })
      .then(response => response.json())
      .then(payload => {
        if (!active) return;
        setEvents(payload?.data?.events ?? []);
      })
      .catch(() => {
        if (active) setEvents([]);
      })
      .finally(() => {
        if (active) setLoadingEvents(false);
      });

    return () => {
      active = false;
    };
  }, [open]);

  return (
    <>
      <div className="fixed bottom-5 right-5 z-40 hidden items-center gap-2 lg:flex">
        <button
          type="button"
          onClick={() => setOpen(open === "activity" ? null : "activity")}
          className="inline-flex size-11 items-center justify-center rounded-xl border border-slate-200 bg-white/95 text-slate-600 shadow-soft backdrop-blur transition duration-200 hover:-translate-y-px hover:border-slate-300 hover:text-slate-950 hover:shadow-lift"
          aria-label="Open Agent Activity"
          aria-expanded={open === "activity"}
        >
          <Activity className="size-4.5" />
        </button>
        <button
          type="button"
          onClick={() => setOpen(open === "chat" ? null : "chat")}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(91,92,226,0.28)] transition duration-200 hover:-translate-y-px hover:bg-brand-600"
          aria-label="Ask SkillTwin"
          aria-expanded={open === "chat"}
        >
          <Sparkles className="size-4" />
          Ask SkillTwin
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 hidden lg:block">
          <button
            type="button"
            aria-label="Close assistant panel"
            onClick={() => setOpen(null)}
            className="absolute inset-0 bg-slate-950/10 backdrop-blur-[1px]"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={open === "chat" ? "Ask SkillTwin" : "Agent Activity"}
            className="drawer-enter absolute inset-y-0 right-0 flex w-[430px] max-w-[92vw] flex-col border-l border-slate-200 bg-white shadow-2xl"
          >
            <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  {open === "chat" ? <MessageSquareText className="size-4.5" /> : <Activity className="size-4.5" />}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {open === "chat" ? "Ask SkillTwin" : "Agent Activity"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {open === "chat" ? "Grounded in your current learner state" : "Committed actions and state changes"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(null)}
                className="inline-flex size-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <X className="size-4.5" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/40 p-4">
              {open === "chat" ? (
                <JourneyChat compact />
              ) : (
                <ActivityPanel events={events} loading={loadingEvents} />
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

function ActivityPanel({ events, loading }: { events: EventRow[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map(item => (
          <div key={item} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="skeleton h-3 w-24 rounded-full" />
            <div className="skeleton mt-3 h-4 w-4/5 rounded-lg" />
            <div className="skeleton mt-2 h-3 w-28 rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.length ? events.map(event => (
        <article key={event.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-400 shadow-[0_0_0_4px_rgba(91,92,226,0.08)]" />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{humanize(event.event_type)}</p>
              <p className="mt-1.5 text-sm leading-6 text-slate-700">{event.summary}</p>
              <p className="mt-2 text-xs text-slate-400">{new Date(event.created_at).toLocaleString()}</p>
            </div>
          </div>
        </article>
      )) : (
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
          No committed activity yet.
        </div>
      )}

      <Link href="/activity" className="btn-secondary w-full">
        Open full activity history
      </Link>
    </div>
  );
}

function humanize(value: string) {
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase());
}
