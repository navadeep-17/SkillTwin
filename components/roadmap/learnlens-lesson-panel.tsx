"use client";

import { useState } from "react";
import {
  BookOpenCheck, CheckCircle2, Clock3, ExternalLink, Lightbulb,
  Play, RotateCcw, ShieldCheck, Sparkles, Video
} from "lucide-react";
import { videoEmbedUrl, type LearnLensLesson } from "@/lib/domain/learnlens-lessons";

/**
 * Formative, local-only learning aid. This intentionally never calls an
 * assessment, completion, evidence or replanning endpoint.
 */
export function LearnLensLessonPanel({ lesson, taskMinutes }: {
  lesson: LearnLensLesson;
  taskMinutes: number;
}) {
  const [allowEmbed, setAllowEmbed] = useState(false);
  const [startSeconds, setStartSeconds] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const [attempt, setAttempt] = useState("");
  const [showSolution, setShowSolution] = useState(false);
  const total = lesson.questions.length;
  const answered = lesson.questions.filter(question => Boolean(answers[question.id])).length;
  const correct = lesson.questions.filter(question => answers[question.id] === question.correctId).length;

  return (
    <section id="learnlens" aria-labelledby="learnlens-title" className="surface-card mt-6 scroll-mt-20 overflow-hidden">
      <div className="border-b border-blue-100 bg-gradient-to-r from-blue-50 via-white to-indigo-50 px-5 py-6 sm:px-7">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-800">
            <Sparkles aria-hidden="true" className="size-3.5"/> SkillTwin LearnLens · Pilot
          </span>
          <span className="text-xs font-medium text-slate-500">{lesson.level === "BASIC" ? "Foundations" : "Applied practice"}</span>
        </div>
        <h2 id="learnlens-title" className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{lesson.title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{lesson.objective}</p>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1"><Clock3 aria-hidden="true" className="size-3.5"/> Suggested {Math.min(taskMinutes, lesson.estimatedMinutes)} min focus block</span>
          <span className="inline-flex items-center gap-1"><ShieldCheck aria-hidden="true" className="size-3.5"/> Reviewed sources · no fabricated transcript</span>
        </div>
      </div>

      <div className="space-y-8 p-5 sm:p-7">
        <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
          <div>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-900">Watch the relevant explanation</h3>
              <span className="text-xs text-slate-500">By {lesson.video.creator}</span>
            </div>
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
              {allowEmbed ? (
                <div className="aspect-video">
                  <iframe
                    key={startSeconds}
                    src={videoEmbedUrl(lesson, startSeconds)}
                    title={lesson.video.title}
                    className="h-full w-full"
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="flex aspect-video flex-col items-center justify-center gap-3 px-5 text-center text-white">
                  <span className="flex size-12 items-center justify-center rounded-full bg-white/15"><Video aria-hidden="true" className="size-6"/></span>
                  <p className="text-sm font-semibold">{lesson.video.title}</p>
                  <p className="max-w-xs text-xs leading-5 text-slate-300">Load the YouTube player only when you choose. The creator hosts the video.</p>
                  <button onClick={() => setAllowEmbed(true)} type="button" className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-blue-100">
                    <Play aria-hidden="true" className="size-4"/> Load video
                  </button>
                </div>
              )}
            </div>
            <a href={lesson.video.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline">
              Watch on YouTube <ExternalLink aria-hidden="true" className="size-3.5"/>
            </a>
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">Jump to a chapter</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">These chapter timings come from the creator's published description.</p>
            <div className="mt-3 space-y-2">
              {lesson.video.chapters.map(chapter => (
                <button
                  key={chapter.seconds}
                  type="button"
                  aria-label={"Play " + chapter.label + " from " + formatTime(chapter.seconds)}
                  onClick={() => {setStartSeconds(chapter.seconds);setAllowEmbed(true);}}
                  className={"flex w-full items-center gap-3 rounded-lg border p-3 text-left text-sm transition hover:border-blue-300 hover:bg-blue-50 " +
                    (allowEmbed && startSeconds === chapter.seconds ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white")}
                >
                  <span className="font-mono text-xs font-semibold text-blue-700">{formatTime(chapter.seconds)}</span>
                  <span className="font-medium text-slate-800">{chapter.label}</span>
                  <Play aria-hidden="true" className="ml-auto size-3.5 text-blue-600"/>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
          <p className="text-sm font-semibold text-amber-900">About the transcript and lesson notes</p>
          <p className="mt-1 text-xs leading-6 text-amber-900">
            A full transcript has not been licensed or retrieved for this video. Below are original SkillTwin
            study notes based on the linked PostgreSQL documentation, not a verbatim transcript or a claim
            that every sentence was spoken in the video. If the video publisher offers captions or a transcript, use the original video page to access them.
          </p>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900">
              <BookOpenCheck aria-hidden="true" className="size-5 text-blue-700"/> Your focused study notes
            </h3>
            <a href={lesson.reference.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline">
              {lesson.reference.publisher} <ExternalLink aria-hidden="true" className="size-3.5"/>
            </a>
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {lesson.studyNotes.map((note, index) => (
              <article key={note.heading} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <span className="text-xs font-semibold text-blue-700">0{index + 1}</span>
                <h4 className="mt-1 text-sm font-semibold text-slate-900">{note.heading}</h4>
                <p className="mt-2 text-xs leading-6 text-slate-600">{note.explanation}</p>
                <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-5 text-blue-100"><code>{note.example}</code></pre>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">3-question knowledge check</h3>
              <p className="mt-1 text-xs text-slate-600">Practice recall before attempting a real assessment.</p>
            </div>
            <span className="text-xs font-semibold text-blue-800">{answered}/{total} answered</span>
          </div>
          <div className="mt-4 space-y-5">
            {lesson.questions.map((question, index) => (
              <fieldset key={question.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <legend className="px-1 text-sm font-semibold text-slate-900">{index + 1}. {question.prompt}</legend>
                <div className="mt-2 space-y-2">
                  {question.options.map(option => (
                    <label key={option.id} className="flex cursor-pointer items-start gap-2 rounded-lg p-1.5 text-sm text-slate-700 hover:bg-slate-50">
                      <input type="radio" name={"learnlens-" + lesson.id + "-" + question.id} value={option.id}
                        checked={answers[question.id] === option.id} disabled={checked}
                        onChange={() => setAnswers(current => ({...current, [question.id]:option.id}))}
                        className="mt-1 accent-blue-700"/>
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
                {checked ? (
                  <p role="status" className={"mt-3 rounded-lg p-3 text-xs leading-5 " +
                    (answers[question.id] === question.correctId ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900")}>
                    {answers[question.id] === question.correctId ? "Correct. " : "Review this concept. "}{question.explanation}
                  </p>
                ) : null}
              </fieldset>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {!checked ? (
              <button type="button" disabled={answered !== total} onClick={() => setChecked(true)}
                className="btn-primary disabled:cursor-not-allowed disabled:opacity-50">Check my answers</button>
            ) : (
              <>
                <p role="status" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <CheckCircle2 aria-hidden="true" className="size-4 text-blue-700"/> {correct} of {total} correct
                </p>
                <button type="button" onClick={() => {setChecked(false);setAnswers({});}}
                  className="btn-secondary inline-flex items-center gap-2"><RotateCcw aria-hidden="true" className="size-4"/> Try again</button>
              </>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-5">
          <h3 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Lightbulb aria-hidden="true" className="size-5 text-amber-600"/> Apply it to a real task
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{lesson.exercise.prompt}</p>
          <label className="mt-4 block text-xs font-semibold text-slate-700" htmlFor={"learnlens-sql-" + lesson.id}>
            Draft your solution (not saved)
          </label>
          <textarea id={"learnlens-sql-" + lesson.id} value={attempt} onChange={event => setAttempt(event.target.value)}
            placeholder={lesson.exercise.starter} rows={5} spellCheck={false}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 font-mono text-xs leading-6 text-slate-900 focus:border-blue-400 focus:outline focus:outline-2 focus:outline-blue-500"/>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <button type="button" className="btn-secondary" onClick={() => setShowSolution(current => !current)}
              aria-expanded={showSolution}>{showSolution ? "Hide example solution" : "Reveal example solution"}</button>
            <span className="text-xs text-slate-500">Compare your logic — no automatic SQL execution</span>
          </div>
          {showSolution ? (
            <div className="mt-4 rounded-xl bg-slate-900 p-4">
              <pre className="overflow-x-auto font-mono text-xs leading-6 text-blue-100"><code>{lesson.exercise.sampleSolution}</code></pre>
              <ul className="mt-3 list-inside list-disc space-y-1 text-xs text-slate-200">
                {lesson.exercise.checklist.map(item => <li key={item}>{item}</li>)}
              </ul>
            </div>
          ) : null}
        </div>
        <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-600">
          LearnLens checks are formative and stay in this browser tab. Watching, selecting an answer, or revealing a solution does not complete your roadmap task, change your skill score, or submit evidence.
        </div>
      </div>
    </section>
  );
}

function formatTime(seconds: number): string {
  return String(Math.floor(seconds / 60)).padStart(2,"0") + ":" + String(seconds % 60).padStart(2,"0");
}
