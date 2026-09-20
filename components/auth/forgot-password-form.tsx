"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: window.location.origin + "/auth/reset-callback"
    });

    setPending(false);
    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("If an account exists for that email, a password reset link has been sent.");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="text-sm font-semibold text-slate-700">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={event => setEmail(event.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-brand-300 focus:ring-4 focus:ring-brand-50"
        />
      </label>
      {message ? (
        <div className="flex gap-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <span>{message}</span>
        </div>
      ) : null}
      <button type="submit" disabled={pending} className="btn-primary w-full !py-3">
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
        {pending ? "Sending" : "Send reset link"}
      </button>
    </form>
  );
}
