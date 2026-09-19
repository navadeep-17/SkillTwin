"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function ProjectEvidenceForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [technologies, setTechnologies] = useState("");
  const [artifactUrl, setArtifactUrl] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setMessage("");

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
      setMessage(
        payload.data.evidence?.deltas?.length
          ? "Project processed and SkillTwin changed."
          : "Project processed. Evidence was stored conservatively."
      );
      router.refresh();
    } catch {
      setMessage("Could not process this project.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Add project evidence</h2>

      <label className="mt-5 block">
        <span className="text-sm font-medium text-slate-700">Project title</span>
        <input
          value={title}
          onChange={event => setTitle(event.target.value)}
          required
          minLength={2}
          maxLength={160}
          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-brand-500 focus:ring-2"
          placeholder="InterviewHub"
        />
      </label>

      <label className="mt-4 block">
        <span className="text-sm font-medium text-slate-700">What did you build and how?</span>
        <textarea
          value={description}
          onChange={event => setDescription(event.target.value)}
          required
          minLength={20}
          maxLength={8000}
          rows={8}
          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-brand-500 focus:ring-2"
          placeholder="Built a full-stack interview experience platform using React and Express. Implemented JWT authentication, REST endpoints, MongoDB persistence..."
        />
        <p className="mt-1 text-xs text-slate-400">Concrete usage sentences create stronger evidence than a technology list alone.</p>
      </label>

      <label className="mt-4 block">
        <span className="text-sm font-medium text-slate-700">Technologies</span>
        <input
          value={technologies}
          onChange={event => setTechnologies(event.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-brand-500 focus:ring-2"
          placeholder="React, Node.js, Express, MongoDB, JWT"
        />
        <p className="mt-1 text-xs text-slate-400">Comma-separated. Mentions alone do not prove proficiency.</p>
      </label>

      <label className="mt-4 block">
        <span className="text-sm font-medium text-slate-700">GitHub / README URL (optional)</span>
        <input
          type="url"
          value={artifactUrl}
          onChange={event => setArtifactUrl(event.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-brand-500 focus:ring-2"
          placeholder="https://github.com/..."
        />
        <p className="mt-1 text-xs text-slate-400">P0 stores the link as metadata; it does not crawl the repository.</p>
      </label>

      {message ? <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{message}</p> : null}

      <button
        type="submit"
        disabled={pending || title.trim().length < 2 || description.trim().length < 20}
        className="mt-5 rounded-xl bg-brand-600 px-5 py-2.5 font-medium text-white disabled:opacity-50"
      >
        {pending ? "Processing evidence…" : "Add project evidence"}
      </button>
    </form>
  );
}
