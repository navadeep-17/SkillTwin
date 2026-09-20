"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Term = {
  id: string;
  raw_term: string;
  context: string;
  created_at: string;
};

type Skill = {
  id: string;
  slug: string;
  canonical_name: string;
  category: string | null;
};

export function UnresolvedSkillTerms() {
  const [terms, setTerms] = useState<Term[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selection, setSelection] = useState<Record<string,string>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/profile/unresolved-skills", { cache: "no-store" });
      const payload = await response.json();
      if (response.ok && payload.ok) {
        setTerms(payload.data.terms ?? []);
        setSkills(payload.data.skills ?? []);
      }
    } catch {
      // This surface is secondary to the completed resume analysis.
    }
  }, []);

  useEffect(() => {
    void load();
    const listener = () => void load();
    window.addEventListener("skilltwin:profile-analysis-complete", listener);
    return () => window.removeEventListener("skilltwin:profile-analysis-complete", listener);
  }, [load]);

  const groupedSkills = useMemo(() => {
    const groups = new Map<string, Skill[]>();
    for (const skill of skills) {
      const key = skill.category || "Other";
      const list = groups.get(key) ?? [];
      list.push(skill);
      groups.set(key, list);
    }
    return [...groups.entries()];
  }, [skills]);

  async function resolve(termId: string, action: "MAP" | "DISMISS") {
    if (pending) return;
    setPending(termId);
    setMessage("");

    try {
      const response = await fetch("/api/profile/unresolved-skills/" + termId, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "MAP"
            ? { action, skillId: selection[termId] }
            : { action }
        )
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setMessage(payload.error?.message ?? "Could not resolve this term.");
        return;
      }
      setTerms(current => current.filter(term => term.id !== termId));
      setMessage(
        action === "MAP"
          ? "Mapped to the canonical catalog. This taxonomy correction does not claim extra proficiency."
          : "Term dismissed."
      );
    } catch {
      setMessage("Could not resolve this term.");
    } finally {
      setPending(null);
    }
  }

  if (!terms.length) return null;

  return (
    <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Needs your review</p>
        <h3 className="mt-1 text-lg font-semibold text-amber-950">Unmapped resume terms</h3>
        <p className="mt-1 text-sm leading-6 text-amber-900">
          SkillTwin found technical terms that it could not safely force into the canonical catalog.
          Map only when the intended skill is clear, or dismiss the term.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {terms.map(term => (
          <article key={term.id} className="rounded-xl border border-amber-200 bg-white p-4">
            <p className="font-semibold">{term.raw_term}</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">{term.context}</p>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <select
                value={selection[term.id] ?? ""}
                onChange={event => setSelection(current => ({ ...current, [term.id]: event.target.value }))}
                className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Choose canonical skill…</option>
                {groupedSkills.map(([category, rows]) => (
                  <optgroup key={category} label={category}>
                    {rows.map(skill => (
                      <option key={skill.id} value={skill.id}>{skill.canonical_name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <button
                type="button"
                disabled={!selection[term.id] || pending === term.id}
                onClick={() => void resolve(term.id, "MAP")}
                className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Map term
              </button>
              <button
                type="button"
                disabled={pending === term.id}
                onClick={() => void resolve(term.id, "DISMISS")}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 disabled:opacity-50"
              >
                Dismiss
              </button>
            </div>
          </article>
        ))}
      </div>

      {message ? <p className="mt-3 text-sm text-amber-900">{message}</p> : null}
    </section>
  );
}
