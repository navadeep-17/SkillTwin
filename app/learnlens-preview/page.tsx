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
const fixtures = [
  {skill:"sql",label:"SQL JOINs"},
  {skill:"python",label:"Python"},
  {skill:"git",label:"Git"},
  {skill:"docker",label:"Docker"}
];

export default async function LearnLensPreviewPage({searchParams}:{
  searchParams:Promise<{skill?:string;level?:string}>
}) {
  const selected = await searchParams;
  const skill = fixtures.some(x=>x.skill===selected.skill)?selected.skill!:"sql";
  const level = selected.level==="STANDARD"?"STANDARD":"BASIC";
  const lesson = getLearnLensLesson({skillSlug:skill,taskType:"LEARN",difficulty:level});
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
      <nav aria-label="Sample lesson selection" className="mt-5 flex flex-wrap items-center gap-2">
        {fixtures.map(item=>(
          <Link key={item.skill} href={"/learnlens-preview?skill="+item.skill+"&level="+level}
            aria-current={skill===item.skill?"page":undefined}
            className={"rounded-lg border px-3 py-2 text-xs font-semibold transition " +
              (skill===item.skill?"border-blue-300 bg-blue-50 text-blue-800":"border-slate-200 bg-white text-slate-700 hover:border-blue-300")}>
            {item.label}
          </Link>
        ))}
        <span className="mx-1 text-slate-300" aria-hidden="true">|</span>
        {(["BASIC","STANDARD"] as const).map(value=>(
          <Link key={value} href={"/learnlens-preview?skill="+skill+"&level="+value}
            aria-current={level===value?"page":undefined}
            className={"rounded-lg border px-3 py-2 text-xs font-semibold transition " +
              (level===value?"border-blue-300 bg-blue-50 text-blue-800":"border-slate-200 bg-white text-slate-700 hover:border-blue-300")}>
            {value==="BASIC"?"Beginner":"Intermediate"}
          </Link>
        ))}
      </nav>
      <LearnLensLessonPanel key={lesson.id} lesson={lesson} taskMinutes={45}/>
    </main>
  );
}
