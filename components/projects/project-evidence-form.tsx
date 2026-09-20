"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, FolderPlus, LoaderCircle, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";

export function ProjectEvidenceForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [technologies, setTechnologies] = useState("");
  const [artifactUrl, setArtifactUrl] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setMessage("");
    setSuccess(false);

    try {
      const response = await fetch("/api/profile/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          technologies: technologies
            .split(",")
            .map(value => value.trim())
            .filter(Boolean),
          artifactUrl: artifactUrl.trim() || null
        })
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setMessage(payload.error?.message ?? "Could not process this project.");
        return;
      }

      setTitle("");
      setDescription("");
      setTechnologies("");
      setArtifactUrl("");
      setSuccess(true);
      setMessage(
        payload.data.evidence?.deltas?.length
          ? "Project processed and your SkillTwin changed."
          : "Project processed. Evidence was stored conservatively."
      );
      router.refresh();
    } catch {
      setMessage("Could not process this project.");
    } finally {
      setPending(false);
    }
  }

  const inputClass = "mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-300 focus:ring-4 focus:ring-brand-50";

  return (
    <form onSubmit={submit} className="surface-card overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <FolderPlus className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold tracking-tight text-slate-950">Add project evidence</h2>
            <p className="mt-0.5 text-xs text-slate-500">Describe what you actually implemented, not just the stack.</p>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Project title</span>
          <input
            value={title}
            onChange={event => setTitle(event.target.value)}
            required
            minLength={2}
            maxLength={160}
            className={inputClass}
            placeholder="InterviewHub"
          />
        </label>

        <label className="mt-5 block">
          <span className="text-sm font-semibold text-slate-700">What did you build and how?</span>
          <textarea
            value={description}
            onChange={event => setDescription(event.target.value)}
            required
            minLength={20}
            maxLength={8000}
            rows={8}
            className={inputClass + " resize-y leading-6"}
            placeholder="Built a full-stack interview experience platform using React and Express. Implemented JWT authentication, REST endpoints, MongoDB persistence..."
          />
          <p className="mt-2 text-xs leading-5 text-slate-400">Concrete implementation and outcome sentences create stronger evidence than a technology list alone.</p>
        </label>

        <label className="mt-5 block">
          <span className="text-sm font-semibold text-slate-700">Technologies</span>
          <input
            value={technologies}
            onChange={event => setTechnologies(event.target.value)}
            className={inputClass}
            placeholder="React, Node.js, Express, MongoDB, JWT"
          />
          <p className="mt-2 text-xs text-slate-400">Comma-separated. Mentions alone do not prove proficiency.</p>
        </label>

        <label className="mt-5 block">
          <span className="text-sm font-semibold text-slate-700">GitHub / README URL <span className="font-normal text-slate-400">(optional)</span></span>
          <input
            type="url"
            value={artifactUrl}
            onChange={event => setArtifactUrl(event.target.value)}
            className={inputClass}
            placeholder="https://github.com/..."
          />
          <p className="mt-2 text-xs text-slate-400">Stored as artifact metadata; SkillTwin does not silently crawl the repository.</p>
        </label>

        <div className="mt-5 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
          Evidence remains traceable to this project submission. The Evidence Engine decides whether the learner state changes.
        </div>

        {message ? (
          <div className={"mt-4 flex gap-2 rounded-xl border p-3 text-sm " + (success ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-rose-100 bg-rose-50 text-rose-700")}>
            {success ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : null}
            <span>{message}</span>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={pending || title.trim().length < 2 || description.trim().length < 20}
          className="btn-primary mt-5 w-full sm:w-auto"
        >
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <FolderPlus className="size-4" />}
          {pending ? "Processing evidence" : "Add project evidence"}
        </button>
      </div>
    </form>
  );
}
