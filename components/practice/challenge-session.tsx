"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Option = { id: string; text: string };

type Question = {
  id: string;
  ordinal: number;
  type: string;
  conceptIds: string[];
  difficulty: number;
  prompt: string;
  options: Option[];
};

type Assessment = {
  id: string;
  skill: { id: string; slug: string; name: string };
  mode: string;
  status: string;
  progress: { answered: number; total: number };
};

type CompletionResult = {
  completed: true;
  outcome?: {
    normalized_score?: number;
    level_signal?: number;
    coverage?: number;
    assessment_confidence?: number;
    strengths?: unknown;
    weaknesses?: unknown;
  };
  evidence?: {
    deltas?: Array<{
      learnerExplanation?: string;
      before?: { level?: string; confidence?: number } | null;
      after?: { level?: string; confidence?: number };
    }>;
  };
  gapAnalysis?: {
    readiness?: number;
    evidenceCoverage?: number;
  } | null;
  replan?: {
    changed?: boolean;
    diff?: {
      diffId?: string;
      fromVersion?: number;
      toVersion?: number | null;
      headline?: string;
      totalMinuteDelta?: number;
      whatChanged?: Array<{
        type?: string;
        task?: { title?: string; durationMinutes?: number };
      }>;
    };
  } | null;
  warnings?: string[];
};

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

export function ChallengeSession({ assessmentId }: { assessmentId: string }) {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<Question | null>(null);
  const [selected, setSelected] = useState("");
  const [feedback, setFeedback] = useState<{ score: number; text: string } | null>(null);
  const [completion, setCompletion] = useState<CompletionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [replanPending, setReplanPending] = useState(false);
  const [error, setError] = useState("");

  const retryReplan = useCallback(async () => {
    setReplanPending(true);
    try {
      const response = await fetch("/api/assessments/" + assessmentId + "/replan", { method: "POST" });
      const payload = await response.json();
      if (response.ok && payload.ok) {
        setCompletion(current => current ? { ...current, replan: payload.data.replan } : current);
      }
    } catch {
      // The assessment result remains valid even if roadmap adaptation is temporarily unavailable.
    } finally {
      setReplanPending(false);
    }
  }, [assessmentId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/assessments/" + assessmentId, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setError(payload.error?.message ?? "Could not load challenge.");
        return;
      }
      setAssessment(payload.data.assessment);
      setQuestion(payload.data.question);
      if (payload.data.outcome) {
        setCompletion({
          completed: true,
          outcome: payload.data.outcome,
          evidence: payload.data.outcome.evidence_batch_result ?? undefined,
          gapAnalysis: payload.data.outcome.gap_snapshot_id
            ? { readiness: undefined, evidenceCoverage: undefined }
            : null
        });
        void retryReplan();
      }
    } catch {
      setError("Could not load challenge.");
    } finally {
      setLoading(false);
    }
  }, [assessmentId, retryReplan]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    if (!question || !selected || submitting) return;

    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/assessments/" + assessmentId + "/answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: question.id,
          optionId: selected,
          idempotencyKey: assessmentId + ":" + question.id + ":" + selected
        })
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setError(payload.error?.message ?? "Could not evaluate answer.");
        return;
      }

      const data = payload.data;
      setFeedback(data.feedback ?? null);

      if (data.completed) {
        setCompletion(data);
        if (data.warnings?.includes("REPLAN_FAILED")) {
          void retryReplan();
        }
        setQuestion(null);
        setPendingQuestion(null);
        setAssessment(current => current
          ? { ...current, status: "COMPLETED", progress: { answered: current.progress.total, total: current.progress.total } }
          : current
        );
      } else {
        setPendingQuestion(data.question ?? null);
        setAssessment(current => current
          ? { ...current, progress: data.progress ?? current.progress }
          : current
        );
      }
    } catch {
      setError("Could not evaluate answer.");
    } finally {
      setSubmitting(false);
    }
  }

  function continueChallenge() {
    setQuestion(pendingQuestion);
    setPendingQuestion(null);
    setSelected("");
    setFeedback(null);
  }

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading challenge…</div>;
  }

  if (error && !assessment) {
    return <div className="rounded-2xl bg-rose-50 p-5 text-sm text-rose-700">{error}</div>;
  }

  if (completion) {
    const outcome = completion.outcome;
    const strengths = asStrings(outcome?.strengths);
    const weaknesses = asStrings(outcome?.weaknesses);
    const delta = completion.evidence?.deltas?.[0];

    return (
      <section className="space-y-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">Validation complete</p>
          <h1 className="mt-2 text-3xl font-semibold">{assessment?.skill.name ?? "Skill"} result</h1>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Metric label="Assessment score" value={outcome?.normalized_score != null ? Math.round(outcome.normalized_score * 100) + "%" : "—"} />
          <Metric label="Coverage" value={outcome?.coverage != null ? Math.round(outcome.coverage * 100) + "%" : "—"} />
          <Metric label="Evaluator confidence" value={outcome?.assessment_confidence != null ? Math.round(outcome.assessment_confidence * 100) + "%" : "—"} />
        </div>

        {delta ? (
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Committed SkillDelta</p>
            <p className="mt-2 font-medium">{delta.learnerExplanation ?? "SkillTwin was recomputed from assessment evidence."}</p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-indigo-900">
              <span>{delta.before?.level ?? "UNKNOWN"} → {delta.after?.level ?? "UNKNOWN"}</span>
              <span>
                Confidence {Math.round((delta.before?.confidence ?? 0) * 100)}% → {Math.round((delta.after?.confidence ?? 0) * 100)}%
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
            The assessment completed without a material canonical SkillTwin change.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <ConceptList title="Strengths" items={strengths} empty="No strong concept signal yet." />
          <ConceptList title="Needs reinforcement" items={weaknesses} empty="No weakness detected in this challenge." />
        </div>

        {completion.gapAnalysis?.readiness != null ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
            Career readiness was recomputed to <strong>{completion.gapAnalysis.readiness}%</strong>.
          </div>
        ) : null}

        {replanPending ? (
          <div className="rounded-xl border border-violet-100 bg-violet-50 p-4 text-sm text-violet-800">
            Checking whether your roadmap should adapt to this result...
          </div>
        ) : null}

        {completion.replan?.changed && completion.replan.diff ? (
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">Roadmap adapted</p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{completion.replan.diff.headline ?? "Roadmap updated from assessment evidence"}</p>
                <p className="mt-1 text-sm text-violet-900">
                  Plan v{completion.replan.diff.fromVersion ?? "—"} → v{completion.replan.diff.toVersion ?? "—"}
                  {completion.replan.diff.totalMinuteDelta != null
                    ? " · +" + completion.replan.diff.totalMinuteDelta + " min targeted work"
                    : ""}
                </p>
              </div>
              {completion.replan.diff.diffId ? (
                <Link
                  href={"/roadmap/changes/" + completion.replan.diff.diffId}
                  className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-medium text-white"
                >
                  See What Changed
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Link href="/overview" className="rounded-xl bg-brand-600 px-4 py-2 font-medium text-white">View SkillTwin</Link>
          <Link href="/roadmap" className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-medium">View roadmap</Link>
        </div>
      </section>
    );
  }

  if (!assessment || !question) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-slate-600">No active question is available.</p>
        <button onClick={() => void load()} className="mt-4 rounded-xl border border-slate-300 px-4 py-2">Reload</button>
      </div>
    );
  }

  const answered = feedback ? assessment.progress.answered : question.ordinal - 1;
  const total = assessment.progress.total || 1;
  const progress = Math.round(100 * Math.min(answered, total) / total);

  return (
    <section>
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">Challenge Me · {assessment.skill.name}</p>
        <div className="mt-3 flex items-center justify-between gap-4 text-sm text-slate-500">
          <span>Question {question.ordinal} of {total}</span>
          <span>Difficulty {question.difficulty}/4</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-brand-600" style={{ width: progress + "%" }} />
        </div>
      </header>

      <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold leading-8">{question.prompt}</h1>

        <div className="mt-5 space-y-3">
          {question.options.map(option => (
            <button
              key={option.id}
              type="button"
              disabled={Boolean(feedback)}
              onClick={() => setSelected(option.id)}
              className={
                "w-full rounded-xl border p-4 text-left transition " +
                (selected === option.id
                  ? "border-brand-500 bg-indigo-50"
                  : "border-slate-200 bg-white hover:border-slate-300") +
                (feedback ? " cursor-default" : "")
              }
            >
              <span className="mr-3 font-semibold text-slate-500">{option.id.toUpperCase()}.</span>
              {option.text}
            </button>
          ))}
        </div>

        {error ? <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

        {feedback ? (
          <div className={feedback.score >= 0.75 ? "mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800" : "mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800"}>
            <p className="font-semibold">{feedback.score >= 0.75 ? "Correct" : "Not quite"}</p>
            <p className="mt-1">{feedback.text}</p>
          </div>
        ) : null}

        <div className="mt-5 flex justify-end">
          {feedback ? (
            <button onClick={continueChallenge} className="rounded-xl bg-brand-600 px-5 py-2.5 font-medium text-white">
              Continue
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!selected || submitting}
              className="rounded-xl bg-brand-600 px-5 py-2.5 font-medium text-white disabled:opacity-50"
            >
              {submitting ? "Evaluating…" : "Submit answer"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function ConceptList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold">{title}</h2>
      {items.length ? (
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          {items.map(item => <li key={item} className="rounded-lg bg-slate-50 px-3 py-2">{humanize(item)}</li>)}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">{empty}</p>
      )}
    </div>
  );
}

function humanize(value: string) {
  return value.replace(/-/g, " ").replace(/\b\w/g, char => char.toUpperCase());
}
