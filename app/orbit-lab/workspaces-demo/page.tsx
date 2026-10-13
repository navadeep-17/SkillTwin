import Link from "next/link";
import {ArrowLeft, Award, BookOpen, CheckCircle2, ShieldCheck} from "lucide-react";
import {OrbitSecondaryWorkspace} from "@/components/orbit/orbit-secondary-workspace";

export const metadata={title:"SkillTwin Orbit — Connected Workspace Demo",description:"Fictional no-write demonstration of the Orbit secondary feature shell."};

export default function WorkspacesDemo(){
  return <div>
    <div className="orbit-sample-header" style={{background:"#0b1020",paddingBottom:13}}>
      <Link href="/orbit-lab"><ArrowLeft size={15}/> Back to prototype</Link>
      <div><ShieldCheck size={15}/><strong>Fictional demonstration · No real learner actions</strong></div>
    </div>
    <OrbitSecondaryWorkspace pathname="/certifications">
      <main className="mx-auto max-w-5xl px-5 py-9 sm:px-8">
        <div className="mb-7 flex items-center gap-3">
          <span className="rounded-xl bg-violet-100 p-3 text-violet-700"><Award size={23}/></span>
          <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Example certification catalog</p>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Make your next credential count.</h2></div>
        </div>
        <p className="max-w-2xl text-sm leading-7 text-slate-600">Sample interface: the real Certifications page continues to read recommendations and progress from SkillTwin services. This demonstration saves nothing.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            {title:"Cloud fundamentals",topic:"Foundational",body:"A sample opportunity to broaden cloud concepts."},
            {title:"Developer tools",topic:"Projects",body:"A sample track to connect credentials with hands-on work."},
            {title:"Data analysis",topic:"Exploration",body:"A sample learning path for analytics foundations."}
          ].map(item=><div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between"><BookOpen size={21} className="text-violet-700"/><span className="text-xs font-bold text-slate-500">{item.topic}</span></div>
            <h3 className="text-lg font-bold text-slate-900">{item.title}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">{item.body}</p>
            <span className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-emerald-700"><CheckCircle2 size={15}/> Fictional preview only</span>
          </div>)}
        </div>
      </main>
    </OrbitSecondaryWorkspace>
  </div>;
}
