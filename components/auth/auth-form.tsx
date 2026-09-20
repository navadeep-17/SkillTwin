"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export function AuthForm({ initialMessage = "" }: { initialMessage?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(initialMessage);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage("");

    const supabase = createClient();
    const normalizedEmail = email.trim().toLowerCase();

    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
      : await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/auth/callback?next=/onboarding"
          }
        });

    setPending(false);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    if (mode === "signup" && !result.data.session) {
      setMessage("Account created. Check your email and confirm your address, then SkillTwin will continue onboarding.");
      return;
    }

    router.replace("/onboarding");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Email</span>
        <input
          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-brand-500 focus:ring-2"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={event => setEmail(event.target.value)}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Password</span>
        <input
          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-brand-500 focus:ring-2"
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          minLength={8}
          required
          value={password}
          onChange={event => setPassword(event.target.value)}
        />
      </label>

      {mode === "signup" ? (
        <p className="text-xs leading-5 text-slate-500">
          Use at least 8 characters. If email confirmation is enabled, you will receive a verification link before onboarding.
        </p>
      ) : null}

      {message ? (
        <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{message}</p>
      ) : null}

      <button
        className="w-full rounded-xl bg-brand-600 px-4 py-2.5 font-medium text-white disabled:opacity-50"
        disabled={pending}
        type="submit"
      >
        {pending ? "Working..." : mode === "signin" ? "Sign in" : "Create account"}
      </button>

      {mode === "signin" ? (
        <a href="/forgot-password" className="block text-center text-sm font-medium text-slate-600 hover:text-slate-950">
          Forgot password?
        </a>
      ) : null}

      <button
        className="w-full text-sm font-medium text-brand-700"
        type="button"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setMessage("");
        }}
      >
        {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
      </button>
    </form>
  );
}
