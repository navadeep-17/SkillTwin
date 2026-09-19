"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

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
  "Why did my roadmap change?",
  "What should I do next?",
  "How ready am I for my target role?",
  "Challenge me",
  "Undo that roadmap change"
];

export function JourneyChat() {
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

  async function rejectAction() {
    if (!proposal || confirming) return;
    setConfirming(true);
    setError("");
    try {
      const response = await fetch("/api/chat/actions/" + proposal.id + "/reject", { method: "POST" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setError(payload.error?.message ?? "The proposal could not be rejected.");
        return;
      }
      setMessages(current => [
        ...current,
        { id: "reject-" + Date.now(), role: "ASSISTANT", content: "Current SkillTwin state kept. The proposed action was rejected." }
      ]);
      setProposal(null);
    } catch {
      setError("The proposal could not be rejected.");
    } finally {
      setConfirming(false);
    }
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
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="min-h-[420px] space-y-4 p-5">
        {!messages.length ? (
          <div className="py-8">
            <p className="text-center text-sm text-slate-500">Try a grounded journey question</p>
            <div className="mx-auto mt-5 flex max-w-2xl flex-wrap justify-center gap-2">
              {starters.map(starter => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => void sendText(starter)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 hover:border-brand-300"
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
            className={message.role === "USER" ? "ml-auto max-w-[85%]" : "mr-auto max-w-[92%]"}
          >
            <div
              className={
                message.role === "USER"
                  ? "rounded-2xl rounded-br-md bg-brand-600 px-4 py-3 text-sm text-white"
                  : "rounded-2xl rounded-bl-md bg-slate-100 px-4 py-3 text-sm leading-6 text-slate-800"
              }
            >
              {message.content}
            </div>
            {message.role === "ASSISTANT" && message.refs?.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {message.refs.map(reference => (
                  <span
                    key={reference.type + ":" + reference.id}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500"
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
          <div className="mr-auto rounded-2xl rounded-bl-md bg-slate-100 px-4 py-3 text-sm text-slate-500">
            Grounding answer in your current SkillTwin…
          </div>
        ) : null}

        {proposal ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Action proposal · confirmation required</p>
            <p className="mt-2 font-medium text-amber-950">{proposal.label}</p>
            <p className="mt-1 text-sm text-amber-800">
              Journey Chat has not executed this action. Confirming will dispatch the existing validated workflow.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={confirmAction}
                disabled={confirming}
                className="rounded-xl bg-amber-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {confirming ? "Validating…" : "Confirm"}
              </button>
              <button
                type="button"
                onClick={rejectAction}
                disabled={confirming}
                className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-900 disabled:opacity-50"
              >
                Keep current state
              </button>
            </div>
          </div>
        ) : null}

        {error ? <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      </div>

      <form onSubmit={submit} className="border-t border-slate-200 bg-slate-50 p-4">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={event => setInput(event.target.value)}
            placeholder="Ask why, what next, challenge me, or propose an undo…"
            className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none ring-brand-500 focus:ring-2"
          />
          <button
            type="submit"
            disabled={!input.trim() || pending}
            className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </section>
  );
}
