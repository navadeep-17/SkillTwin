import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, BookOpenCheck } from "lucide-react";
import { getLearnLensLesson } from "@/lib/domain/learnlens-lessons";
import { LearnLensLessonPanel } from "@/components/roadmap/learnlens-lesson-panel";

export const metadata: Metadata = {
  title: "LearnLens sample · SkillTwin",
  description: "A fictional, read-only preview of an interactive skill-specific learning lesson.",
  robots: { index: false, follow: false }
};

/** Public fixture for visual QA. No actual learner task, grade or evidence. */
export default function LearnLensPreviewPage() {
  const lesson = getLearnLensLesson({skillSlug:"sql",taskType:"LEARN",difficulty:"BASIC"});
  if (!lesson) return null;

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
      <Link href="/" className="quiet-link inline-flex items-center gap-2 text-sm">
        <ArrowLeft className="size-4"/> Back to SkillTwin
      </Link>
      <div className="mt-6 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
        <BookOpenCheck className="mt-0.5 size-5 shrink-0 text-blue-700"/>
        <div>
          <p className="font-semibold text-slate-900">Sample lesson · no learner account needed</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            This public preview uses a fictional SQL task. The same lesson component appears inside
            a signed-in learner's eligible roadmap task. Nothing is saved, scored or submitted here.
          </p>
        </div>
      </div>
      <LearnLensLessonPanel lesson={lesson} taskMinutes={45}/>
    </main>
  );
}
