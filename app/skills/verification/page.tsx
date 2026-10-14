import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertCircle, ArrowLeft, BookOpen, CheckCircle2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getEvidenceA3Preview } from "@/lib/services/gaps/evidence-verification-a3-service";

const humanize=(value:string)=>value.replaceAll("_"," ").replaceAll("-"," ").toLowerCase()
  .replace(/\b\w/g,c=>c.toUpperCase());

export default async function SkillVerificationPreviewPage(){
  if(process.env.SKILLTWIN_EVIDENCE_A3_ENABLED!=="true")notFound();
  const supabase=await createClient();
  const {data,error}=await supabase.auth.getUser();
  if(error||!data.user)redirect("/login");
  const preview=await getEvidenceA3Preview(data.user.id);
  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:px-6 lg:py-12">
      <Link href="/skills" className="quiet-link inline-flex items-center gap-2 text-sm">
        <ArrowLeft className="size-4"/> Back to your skills
      </Link>
      <header className="mt-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
          <ShieldCheck className="size-3.5"/> A3 research preview · no scores changed
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
          What have you actually demonstrated?
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          A numerical skill estimate is not the same as verified proficiency. This pilot keeps your
          existing readiness score while distinguishing reviewed quiz knowledge, practical work,
          unverified claims, and competencies that still need checking.
        </p>
      </header>
      {!preview ? (
        <section className="surface-card mt-7 p-6">
          <h2 className="font-semibold text-slate-900">No role-gap snapshot yet</h2>
          <p className="mt-2 text-sm text-slate-600">
            Choose your target role and analyze some evidence before previewing competency verification.
          </p>
          <Link href="/onboarding" className="btn-primary mt-4">Complete onboarding</Link>
        </section>
      ):(
        <>
          <section className="mt-7 grid gap-4 sm:grid-cols-3">
            <div className="surface-card p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Original A1 readiness</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{preview.projection.originalReadiness}%</p>
              <p className="mt-1 text-xs text-slate-500">Preserved unchanged; not hiring probability</p>
            </div>
            <div className="surface-card p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Mapped knowledge checks</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{preview.knowledgeObservationCount}</p>
              <p className="mt-1 text-xs text-slate-500">Trusted scored quiz attempts, not code proof</p>
            </div>
            <div className="surface-card p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Role skills inspected</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{preview.projection.results.length}</p>
              <p className="mt-1 text-xs text-slate-500">Only six draft skill rubrics available</p>
            </div>
          </section>
          <div className="mt-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            <AlertCircle className="mt-0.5 size-5 shrink-0"/>
            <p>
              A3 is an experimental interpretation, not a new readiness calculation.
              A question about a concept can show knowledge without establishing that you can implement it.
              Your original A1 skill and gap records remain untouched.
            </p>
          </div>
          <section className="mt-8 space-y-4" aria-label="Competency verification results">
            <h2 className="text-xl font-semibold text-slate-900">Role requirement verification</h2>
            {preview.projection.results.map(item=>(
              <article key={item.requirementId} className="surface-card p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{humanize(item.skillSlug??"Unmapped Skill")}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Existing gap: {humanize(item.originalStatus)} · A3 review: {humanize(item.displayStatus)}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                    {humanize(item.verificationStatus)}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {item.verificationStatus==="SUPPORTED"
                    ? "All criteria for this target tier have independent task-level demonstrations in the reviewed data."
                    : item.verificationStatus==="RUBRIC_NOT_AVAILABLE"
                    ? "This role skill does not yet have a reviewed A3 rubric; the original assessment remains visible."
                    : "The required hands-on competency is not fully demonstrated yet. Consider the missing criteria before interpreting the numeric skill estimate as verified."}
                </p>
                {item.demonstratedCoverage!=null?(
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Hands-on verified coverage</span>
                      <span>{Math.round(item.demonstratedCoverage*100)}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-emerald-500" style={{width:(item.demonstratedCoverage*100)+"%"}}/>
                    </div>
                  </div>
                ):null}
                {item.knowledgeCheckedCriteria.length?(
                  <div className="mt-4 rounded-lg border border-sky-100 bg-sky-50 p-3">
                    <p className="flex items-center gap-2 text-xs font-semibold text-sky-800">
                      <BookOpen className="size-4"/> Knowledge checked (not hands-on verified)
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-sky-900">
                      {item.knowledgeCheckedCriteria.map(c=><li key={c.id}>{c.description}</li>)}
                    </ul>
                  </div>
                ):null}
                {item.knowledgeGapCriteria.length?(
                  <div className="mt-3 rounded-lg border border-rose-100 bg-rose-50 p-3">
                    <p className="text-xs font-semibold text-rose-800">Quiz concepts to review</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-rose-900">
                      {item.knowledgeGapCriteria.map(c=><li key={c.id}>{c.description}</li>)}
                    </ul>
                  </div>
                ):null}
                {item.missingCriteria.length?(
                  <details className="mt-4 rounded-lg bg-slate-50 p-3">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-700">
                      Criteria still requiring practical validation ({item.missingCriteria.length})
                    </summary>
                    <ul className="mt-2 list-disc space-y-2 pl-5 text-xs leading-5 text-slate-600">
                      {item.missingCriteria.map(c=><li key={c.id}>{c.description}</li>)}
                    </ul>
                  </details>
                ):null}
                {item.failedCriteria.length?(
                  <div className="mt-3 text-xs font-semibold text-rose-700">
                    {item.failedCriteria.length} independently evaluated criterion/criteria need review
                  </div>
                ):null}
                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span>Recommended: {humanize(item.recommendedAction)}</span>
                  <span>Mapped observations: {item.evidenceIds.length}</span>
                  <span>Other legacy evidence: {preview.legacyEvidenceCountsBySkill[item.skillId]??0}</span>
                </div>
              </article>
            ))}
          </section>
          <footer className="mt-7 rounded-lg bg-slate-50 p-4 text-xs leading-6 text-slate-500">
            <p className="flex items-start gap-2"><CheckCircle2 className="mt-1 size-4 shrink-0"/> Read-only A3 pilot, based on a whitelist of reviewed bank questions. {preview.unmappedOrUntrustedAttemptCount} of {preview.scannedAttemptCount} inspected attempts were unmapped or did not meet trust requirements.{preview.attemptsTruncated?" Only the latest 400 attempts were inspected.":""}</p>
            <p className="mt-2">Other resume and project evidence is still retained in A1, but it is not automatically promoted to A3 competency proof. Source mappings and rubrics are drafts and need expert validation.</p>
          </footer>
        </>
      )}
    </main>
  );
}
