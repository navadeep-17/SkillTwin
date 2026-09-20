"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setMessage("Passwords do not match.");
      return;
    }

    setPending(true);
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setPending(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Password updated. Redirecting to your SkillTwin...");
    router.replace("/overview");
    router.refresh();
  }

  const inputClass = "mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-brand-300 focus:ring-4 focus:ring-brand-50";

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="text-sm font-semibold text-slate-700">New password</span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={event => setPassword(event.target.value)}
          className={inputClass}
        />
      </label>
      <label className="block">
        <span className="text-sm font-semibold text-slate-700">Confirm password</span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirm}
          onChange={event => setConfirm(event.target.value)}
          className={inputClass}
        />
      </label>
      {message ? <p className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-700">{message}</p> : null}
      <button type="submit" disabled={pending} className="btn-primary w-full !py-3">
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
        {pending ? "Updating" : "Update password"}
      </button>
    </form>
  );
}
