"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export function AuthForm({
  initialMessage = "",
  nextPath = "/onboarding"
}: {
  initialMessage?: string;
  nextPath?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
            emailRedirectTo: window.location.origin + "/auth/callback"
          }
        });

    setPending(false);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    if (mode === "signup" && !result.data.session) {
      setMessage("Account created. Check your email to verify your address, then continue onboarding.");
      return;
    }

    router.replace(mode === "signin" ? nextPath : "/onboarding");
    router.refresh();
  }

  return (
    <div>
      <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => {
            setMode("signin");
            setMessage("");
          }}
          className={"rounded-lg px-3 py-2 text-sm font-semibold transition " + (mode === "signin" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500")}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("signup");
            setMessage("");
          }}
          className={"rounded-lg px-3 py-2 text-sm font-semibold transition " + (mode === "signup" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500")}
        >
          Create account
        </button>
      </div>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Email</span>
          <input
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-brand-300 focus:ring-4 focus:ring-brand-50"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            value={email}
            onChange={event => setEmail(event.target.value)}
          />
        </label>

        <label className="block">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-slate-700">Password</span>
            {mode === "signin" ? (
              <Link href="/forgot-password" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                Forgot password?
              </Link>
            ) : null}
          </div>
          <div className="relative mt-2">
            <input
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 pr-11 text-sm outline-none transition focus:border-brand-300 focus:ring-4 focus:ring-brand-50"
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              minLength={8}
              placeholder="At least 8 characters"
              required
              value={password}
              onChange={event => setPassword(event.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword(value => !value)}
              className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-slate-400 transition hover:text-slate-700"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </label>

        {mode === "signup" ? (
          <p className="text-xs leading-5 text-slate-500">
            Use at least 8 characters. If email confirmation is enabled, we will send a verification link before onboarding.
          </p>
        ) : null}

        {message ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm leading-6 text-slate-700">{message}</p>
        ) : null}

        <button className="btn-primary w-full !py-3" disabled={pending} type="submit">
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
          {pending ? "Working" : mode === "signin" ? "Continue to SkillTwin" : "Create my SkillTwin"}
        </button>
      </form>

      <p className="mt-5 text-center text-xs leading-5 text-slate-400">
        By continuing, your learner state remains private to your account and protected by row-level access controls.
      </p>
    </div>
  );
}
