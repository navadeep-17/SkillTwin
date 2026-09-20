"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, CheckCircle2, LoaderCircle, Sparkles } from "lucide-react";

type Ref = { type: string; id: string; label: string };

type Message = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  refs?: Ref[];
};

type Proposal = {
  id: string;
  actionType: "UNDO_PLAN_DIFF" | "START_ASSESSMENT" | "GENERATE_PLAN";
  label: string;
  payload: Record<string, unknown>;
  expiresAt: string;
};

const starters = [
  "What should I focus on next?",
  "Why did my roadmap change?",
  "How ready am I for my target role?",
  "Challenge me",
  "Explain my biggest skill gap"
];

export function JourneyChat({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  async function sendText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;

    const userMessage: Message = {
      id: "local-" + Date.now(),
      role: "USER",
      content: trimmed
    };

    setMessages(current => [...current, userMessage]);
    setInput("");
    setProposal(null);
    setError("");
    setPending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          threadId
        })
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setError(payload.error?.message ?? "Journey Chat could not answer.");
        return;
      }

      setThreadId(payload.data.threadId);
      setMessages(current => [
        ...current,
        {
          id: payload.data.message.id,
          role: "ASSISTANT",
          content: payload.data.message.content,
          refs: payload.data.message.refs ?? []
        }
      ]);
      setProposal(payload.data.actionProposal ?? null);
    } catch {
      setError("Journey Chat could not answer.");
    } finally {
      setPending(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await sendText(input);
  }

  async function confirmAction() {
    if (!proposal || confirming) return;
    setConfirming(true);
    setError("");

    try {
      const response = await fetch("/api/chat/actions/" + proposal.id + "/confirm", {
        method: "POST"
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setError(payload.error?.message ?? "The proposed action could not be safely executed.");
        return;
      }

      setMessages(current => [
        ...current,
        {
          id: "action-" + Date.now(),
          role: "ASSISTANT",
          content: "Confirmed action completed successfully."
        }
      ]);
      setProposal(null);

      const href = payload.ui_effects?.next_action?.href;
      if (href) router.push(href);
      router.refresh();
    } catch {
      setError("The proposed action could not be safely executed.");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <section className={compact ? "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" : "surface-card overflow-hidden"}>
      <div className={compact ? "min-h-[460px] space-y-4 p-4" : "min-h-[460px] space-y-4 p-5 sm:p-6"}>
        {!messages.length ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center py-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <Sparkles className="size-5" />
            </span>
            <h2 className="mt-4 text-lg font-semibold tracking-tight text-slate-900">Ask about your current journey</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
              SkillTwin answers from your stored skills, gaps, plan, assessments, and recent changes.
            </p>
            <div className="mt-5 flex max-w-2xl flex-wrap justify-center gap-2">
              {starters.map(starter => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => void sendText(starter)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 transition hover:-translate-y-px hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map(message => (
          <div
            key={message.id}
            className={"fade-up " + (message.role === "USER" ? "ml-auto max-w-[85%]" : "mr-auto max-w-[94%]")}
          >
            <div
              className={
                message.role === "USER"
                  ? "rounded-2xl rounded-br-md bg-brand-500 px-4 py-3 text-sm leading-6 text-white shadow-sm"
                  : "rounded-2xl rounded-bl-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700"
              }
            >
              {message.content}
            </div>
            {message.role === "ASSISTANT" && message.refs?.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {message.refs.map(reference => (
                  <span
                    key={reference.type + ":" + reference.id}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500"
                    title={reference.type + ":" + reference.id}
                  >
                    {reference.label}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ))}

        {pending ? (
          <div className="mr-auto flex max-w-[90%] items-center gap-3 rounded-2xl rounded-bl-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            <span className="flex gap-1">
              <span className="size-1.5 animate-pulse rounded-full bg-brand-400" />
              <span className="size-1.5 animate-pulse rounded-full bg-brand-400 [animation-delay:120ms]" />
              <span className="size-1.5 animate-pulse rounded-full bg-brand-400 [animation-delay:240ms]" />
            </span>
            Grounding in your current SkillTwin…
          </div>
        ) : null}

        {proposal ? (
          <div className="soft-pop rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Action proposal · confirmation required</p>
            <p className="mt-2 font-semibold text-amber-950">{proposal.label}</p>
            <p className="mt-1 text-sm leading-6 text-amber-800">
              Nothing has changed yet. Confirming dispatches the existing validated workflow after a fresh permission/state check.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={confirmAction}
                disabled={confirming}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {confirming ? <LoaderCircle className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                {confirming ? "Validating" : "Confirm action"}
              </button>
              <button
                type="button"
                onClick={() => setProposal(null)}
                className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900"
              >
                Keep current state
              </button>
            </div>
          </div>
        ) : null}

        {error ? <p className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      </div>

      <form onSubmit={submit} className="border-t border-slate-100 bg-white p-3.5">
        <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-1.5 transition focus-within:border-brand-200 focus-within:bg-white focus-within:ring-4 focus-within:ring-brand-50">
          <textarea
            value={input}
            onChange={event => setInput(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendText(input);
              }
            }}
            rows={1}
            placeholder="Ask what matters next…"
            className="max-h-32 min-h-10 min-w-0 flex-1 resize-none bg-transparent px-2.5 py-2 text-sm leading-5 text-slate-800 outline-none placeholder:text-slate-400"
          />
          <button
            type="submit"
            disabled={!input.trim() || pending}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white transition hover:bg-brand-600 disabled:opacity-40"
            aria-label="Send message"
          >
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          </button>
        </div>
        <p className="mt-2 px-1 text-[11px] text-slate-400">
          Read-only by default. Any mutation requires explicit confirmation.
        </p>
      </form>
    </section>
  );
}
