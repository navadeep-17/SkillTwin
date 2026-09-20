"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, LoaderCircle, Sparkles } from "lucide-react";

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
  const [answerText, setAnswerText] = useState("");
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
      // Assessment state remains valid when adaptation is temporarily unavailable.
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
    if (!question || submitting) return;
    const constructed = question.type === "SHORT_TEXT" || question.type === "SCENARIO";
    if (constructed ? answerText.trim().length < 3 : !selected) return;

    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/assessments/" + assessmentId + "/answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: question.id,
          optionId: constructed ? undefined : selected,
          answerText: constructed ? answerText.trim() : undefined
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
        if (data.warnings?.includes("REPLAN_FAILED")) void retryReplan();
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
    setAnswerText("");
    setFeedback(null);
  }

  if (loading) {
    return <ChallengeSkeleton />;
  }

  if (error && !assessment) {
    return <div className="rounded-2xl border border-rose-100 bg-rose-50 p-5 text-sm text-rose-700">{error}</div>;
  }

  if (completion) {
    const outcome = completion.outcome;
    const strengths = asStrings(outcome?.strengths);
    const weaknesses = asStrings(outcome?.weaknesses);
    const delta = completion.evidence?.deltas?.[0];
    const beforeConfidence = Math.round((delta?.before?.confidence ?? 0) * 100);
    const afterConfidence = Math.round((delta?.after?.confidence ?? 0) * 100);

    return (
      <section className="soft-pop space-y-5">
        <div className="surface-card hero-wash relative overflow-hidden p-6 sm:p-8">
          <div className="relative">
            <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="size-5" />
            </div>
            <p className="eyebrow mt-5 !text-emerald-700">Validation complete</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.025em] text-slate-950">
              {assessment?.skill.name ?? "Skill"} has new evidence.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              SkillTwin evaluated the completed assessment, committed accepted evidence, and checked whether your roadmap should adapt.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Metric label="Assessment score" value={outcome?.normalized_score != null ? Math.round(outcome.normalized_score * 100) + "%" : "—"} />
          <Metric label="Coverage" value={outcome?.coverage != null ? Math.round(outcome.coverage * 100) + "%" : "—"} />
          <Metric label="Evaluator confidence" value={outcome?.assessment_confidence != null ? Math.round(outcome.assessment_confidence * 100) + "%" : "—"} />
        </div>

        {delta ? (
          <div className="surface-card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
              <p className="eyebrow">SkillTwin updated</p>
              <p className="mt-1 text-sm text-slate-500">Canonical learner state changed after accepted assessment evidence.</p>
            </div>
            <div className="grid gap-6 p-5 sm:grid-cols-2 sm:p-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Capability</p>
                <div className="mt-3 flex items-center gap-3">
                  <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-500 line-through decoration-slate-300">
                    {humanize(delta.before?.level ?? "UNKNOWN")}
                  </span>
                  <ArrowRight className="size-4 text-slate-300" />
                  <span className="rounded-lg bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700">
                    {humanize(delta.after?.level ?? "UNKNOWN")}
                  </span>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium uppercase tracking-wide text-slate-400">Confidence</span>
                  <span className="font-semibold text-slate-700">{beforeConfidence}% → {afterConfidence}%</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="progress-fill h-full rounded-full bg-brand-500 transition-all duration-700" style={{ width: Math.max(2, afterConfidence) + "%" }} />
                </div>
              </div>
            </div>
            {delta.learnerExplanation ? (
              <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4 text-sm text-slate-600 sm:px-6">
                {delta.learnerExplanation}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
            The assessment completed without a material canonical SkillTwin change.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <ConceptList title="Strengths" items={strengths} empty="No strong concept signal yet." tone="success" />
          <ConceptList title="Needs reinforcement" items={weaknesses} empty="No weakness detected in this challenge." tone="warning" />
        </div>

        {completion.gapAnalysis?.readiness != null ? (
          <div className="surface-card p-4 text-sm text-slate-600">
            Career readiness was recomputed to <strong className="text-slate-900">{completion.gapAnalysis.readiness}%</strong>.
          </div>
        ) : null}

        {replanPending ? (
          <div className="flex items-center gap-3 rounded-xl border border-brand-100 bg-brand-50/70 p-4 text-sm text-brand-800">
            <LoaderCircle className="size-4 animate-spin" />
            Checking whether this new evidence should change your future work…
          </div>
        ) : null}

        {completion.replan?.changed && completion.replan.diff ? (
          <div className="surface-card border-brand-100 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700">
                  <Sparkles className="size-3.5" />
                  Roadmap adapted
                </div>
                <p className="mt-3 font-semibold text-slate-900">
                  {completion.replan.diff.headline ?? "Your roadmap was updated from assessment evidence"}
                </p>
                <p className="mt-1.5 text-sm text-slate-500">
                  Plan v{completion.replan.diff.fromVersion ?? "—"} → v{completion.replan.diff.toVersion ?? "—"}
                  {completion.replan.diff.totalMinuteDelta != null
                    ? " · " + (completion.replan.diff.totalMinuteDelta >= 0 ? "+" : "") + completion.replan.diff.totalMinuteDelta + " min"
                    : ""}
                </p>
              </div>
              {completion.replan.diff.diffId ? (
                <Link href={"/roadmap/changes/" + completion.replan.diff.diffId} className="btn-primary">
                  See what changed <ArrowRight className="size-4" />
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Link href="/overview" className="btn-primary">View my SkillTwin</Link>
          <Link href="/roadmap" className="btn-secondary">View roadmap</Link>
        </div>
      </section>
    );
  }

  if (!assessment || !question) {
    return (
      <div className="surface-card p-6">
        <p className="text-slate-600">No active question is available.</p>
        <button onClick={() => void load()} className="btn-secondary mt-4">Reload</button>
      </div>
    );
  }

  const answered = feedback ? assessment.progress.answered : question.ordinal - 1;
  const total = assessment.progress.total || 1;
  const progress = Math.round(100 * Math.min(answered, total) / total);

  return (
    <section>
      <header>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="eyebrow">Challenge Me · {assessment.skill.name}</p>
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
            Difficulty {question.difficulty}/4
          </span>
        </div>
        <div className="mt-4 flex items-center justify-between gap-4 text-xs text-slate-500">
          <span>Question {question.ordinal} of {total}</span>
          <span>{progress}% complete</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="progress-fill h-full rounded-full bg-brand-500 transition-all duration-500" style={{ width: progress + "%" }} />
        </div>
      </header>

      <div key={question.id} className="fade-up surface-card mt-6 p-5 sm:p-7">
        <h1 className="max-w-3xl text-xl font-semibold leading-8 tracking-tight text-slate-950">{question.prompt}</h1>

        {question.type === "MCQ" ? (
          <div className="mt-6 space-y-3">
            {question.options.map(option => {
              const isSelected = selected === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={Boolean(feedback)}
                  onClick={() => setSelected(option.id)}
                  className={
                    "group flex w-full items-start gap-3 rounded-xl border p-4 text-left transition duration-200 " +
                    (isSelected
                      ? "border-brand-300 bg-brand-50/70 shadow-sm"
                      : "border-slate-200 bg-white hover:-translate-y-px hover:border-slate-300 hover:shadow-sm") +
                    (feedback ? " cursor-default" : "")
                  }
                >
                  <span
                    className={
                      "flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold transition " +
                      (isSelected ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-500 group-hover:bg-slate-200")
                    }
                  >
                    {option.id.toUpperCase()}
                  </span>
                  <span className="pt-0.5 text-sm leading-6 text-slate-700">{option.text}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <label className="mt-6 block">
            <span className="text-sm font-semibold text-slate-700">
              {question.type === "SCENARIO" ? "Your reasoning" : "Your answer"}
            </span>
            <textarea
              value={answerText}
              onChange={event => setAnswerText(event.target.value)}
              disabled={Boolean(feedback)}
              rows={question.type === "SCENARIO" ? 7 : 4}
              maxLength={3000}
              placeholder={question.type === "SCENARIO"
                ? "Explain the decision you would make and why."
                : "Answer in your own words."}
              className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white p-4 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-300 focus:ring-4 focus:ring-brand-50 disabled:bg-slate-50"
            />
            <p className="mt-2 text-xs leading-5 text-slate-400">
              Evaluated against the stored rubric. Your text is treated as learner content, not evaluator instructions.
            </p>
          </label>
        )}

        {error ? <p className="mt-4 rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

        {feedback ? (
          <div
            className={
              "soft-pop mt-5 rounded-xl border p-4 text-sm " +
              (feedback.score >= 0.75
                ? "border-emerald-100 bg-emerald-50 text-emerald-800"
                : "border-amber-100 bg-amber-50 text-amber-800")
            }
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-4.5 shrink-0" />
              <div>
                <p className="font-semibold">
                  {question.type === "MCQ"
                    ? feedback.score >= 0.75 ? "Correct" : "Not quite"
                    : feedback.score >= 0.75 ? "Strong answer" : "Needs more detail"}
                </p>
                <p className="mt-1 leading-6">{feedback.text}</p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex justify-end">
          {feedback ? (
            <button onClick={continueChallenge} className="btn-primary">
              Continue <ArrowRight className="size-4" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={(question.type === "MCQ" ? !selected : answerText.trim().length < 3) || submitting}
              className="btn-primary"
            >
              {submitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
              {submitting ? "Evaluating" : "Submit answer"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function ChallengeSkeleton() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="skeleton h-3 w-48 rounded-full" />
        <div className="skeleton h-7 w-24 rounded-lg" />
      </div>
      <div className="skeleton mt-4 h-1.5 w-full rounded-full" />
      <div className="surface-card mt-6 p-6">
        <div className="skeleton h-6 w-4/5 rounded-lg" />
        <div className="mt-6 space-y-3">
          {[0, 1, 2, 3].map(item => <div key={item} className="skeleton h-14 w-full rounded-xl" />)}
        </div>
        <div className="mt-6 flex justify-end">
          <div className="skeleton h-10 w-32 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
    </div>
  );
}

function ConceptList({
  title,
  items,
  empty,
  tone
}: {
  title: string;
  items: string[];
  empty: string;
  tone: "success" | "warning";
}) {
  const dot = tone === "success" ? "bg-emerald-500" : "bg-amber-500";
  return (
    <div className="surface-card p-5">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      {items.length ? (
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          {items.map(item => (
            <li key={item} className="flex gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
              <span className={"mt-2 size-1.5 shrink-0 rounded-full " + dot} />
              <span>{humanize(item)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">{empty}</p>
      )}
    </div>
  );
}

function humanize(value: string) {
  return value.replace(/[-_]/g, " ").replace(/\b\w/g, char => char.toUpperCase());
}
