"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DemoResetControl() {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function reset() {
    if (!secret.trim() || pending) return;

    const confirmed = window.confirm(
      "Reset all learner-specific SkillTwin state for this signed-in account?"
    );
    if (!confirmed) return;

    setPending(true);
    setMessage("");

    try {
      const response = await fetch("/api/demo/reset", {
        method: "POST",
        headers: {
          "x-skilltwin-demo-secret": secret
        }
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setMessage(payload.error?.message ?? "Demo reset failed.");
        return;
      }

      setSecret("");
      router.push("/onboarding");
      router.refresh();
    } catch {
      setMessage("Demo reset failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="max-w-xl">
      <label className="block">
        <span className="text-sm font-medium text-amber-950">Demo reset secret</span>
        <input
          type="password"
          autoComplete="off"
          value={secret}
          onChange={event => setSecret(event.target.value)}
          placeholder="Enter DEMO_RESET_SECRET"
          className="mt-2 w-full rounded-xl border border-amber-300 bg-white px-3 py-2 outline-none ring-amber-500 focus:ring-2"
        />
      </label>

      <button
        type="button"
        onClick={reset}
        disabled={!secret.trim() || pending}
        className="mt-3 rounded-xl bg-amber-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Resetting…" : "Reset learner demo state"}
      </button>

      {message ? <p className="mt-3 text-sm text-rose-700">{message}</p> : null}
    </div>
  );
}
