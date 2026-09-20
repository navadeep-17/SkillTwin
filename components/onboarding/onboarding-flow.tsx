"use client";

import { useEffect, useMemo, useState } from "react";
import { ResumeAnalyzer } from "@/components/onboarding/resume-analyzer";

type Role = {
  id: string;
  slug: string;
  name: string;
  family: string | null;
  roleVersionId: string;
  version: number;
  requirementCount: number;
};

type GoalEnvelope = {
  ok: boolean;
  data?: {
    goal?: {
      id: string;
      role_version_id: string;
      target_date: string | null;
      hours_per_week: number | string;
      preferred_session_minutes: number;
      learning_days: string[];
      adaptation_mode: "AUTOMATIC" | "ASK_FIRST";
    } | null;
  };
  error?: { message?: string };
};

type RolesEnvelope = {
  ok: boolean;
  data?: { roles?: Role[] };
  error?: { message?: string };
};

const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"] as const;

export function OnboardingFlow() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState("");
  const [hoursPerWeek, setHoursPerWeek] = useState(10);
  const [targetDate, setTargetDate] = useState("");
  const [preferredSessionMinutes, setPreferredSessionMinutes] = useState(60);
  const [learningDays, setLearningDays] = useState<string[]>(["Mon","Tue","Wed","Thu","Fri","Sat"]);
  const [adaptationMode, setAdaptationMode] = useState<"AUTOMATIC" | "ASK_FIRST">("AUTOMATIC");
  const [goalSaved, setGoalSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [rolesResponse, goalResponse] = await Promise.all([
          fetch("/api/roles", { cache: "no-store" }),
          fetch("/api/goals", { cache: "no-store" })
        ]);

        const roleJson = await rolesResponse.json() as RolesEnvelope;
        const goalJson = await goalResponse.json() as GoalEnvelope;

        if (!rolesResponse.ok || !roleJson.ok) {
          throw new Error(roleJson.error?.message ?? "Could not load target roles.");
        }
        if (!goalResponse.ok || !goalJson.ok) {
          throw new Error(goalJson.error?.message ?? "Could not load your career goal.");
        }

        if (cancelled) return;

        const loadedRoles = roleJson.data?.roles ?? [];
        setRoles(loadedRoles);

        const goal = goalJson.data?.goal;
        if (goal) {
          setSelectedRole(goal.role_version_id);
          setHoursPerWeek(Number(goal.hours_per_week) || 10);
          setTargetDate(goal.target_date ?? "");
          setPreferredSessionMinutes(Number(goal.preferred_session_minutes) || 60);
          setLearningDays(Array.isArray(goal.learning_days) && goal.learning_days.length ? goal.learning_days : ["Mon","Tue","Wed","Thu","Fri","Sat"]);
          setAdaptationMode(goal.adaptation_mode === "ASK_FIRST" ? "ASK_FIRST" : "AUTOMATIC");
          setGoalSaved(true);
        } else if (loadedRoles.length) {
          setSelectedRole(loadedRoles[0].roleVersionId);
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not load onboarding.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const role = useMemo(
    () => roles.find(item => item.roleVersionId === selectedRole) ?? null,
    [roles, selectedRole]
  );

  function toggleDay(day: string) {
    setGoalSaved(false);
    setLearningDays(current =>
      current.includes(day)
        ? current.filter(item => item !== day)
        : [...current, day]
    );
  }

  async function saveGoal() {
    if (!selectedRole || learningDays.length === 0) return;
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleVersionId: selectedRole,
          targetDate: targetDate || null,
          hoursPerWeek,
          preferredSessionMinutes,
          minSessionMinutes: Math.min(30, preferredSessionMinutes),
          learningDays,
          preferredFormats: ["projects","practice","documentation"],
          adaptationMode
        })
      });
      const json = await response.json() as { ok: boolean; error?: { message?: string } };

      if (!response.ok || !json.ok) {
        throw new Error(json.error?.message ?? "Could not save your goal.");
      }

      setGoalSaved(true);
      setMessage("Career goal saved. Your SkillTwin will use this role for gap analysis and planning.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save your goal.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        Loading your learner profile...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Step 1 · Target</p>
            <h2 className="mt-1 text-xl font-semibold">Choose where you want to go</h2>
            <p className="mt-2 text-sm text-slate-600">
              SkillTwin compares your evidence against a versioned competency model for this role.
            </p>
          </div>
          {goalSaved && role ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Saved · {role.name}
            </span>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map(item => {
            const selected = item.roleVersionId === selectedRole;
            return (
              <button
                type="button"
                key={item.roleVersionId}
                onClick={() => {
                  setSelectedRole(item.roleVersionId);
                  setGoalSaved(false);
                }}
                className={[
                  "rounded-xl border p-4 text-left transition",
                  selected
                    ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100"
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                ].join(" ")}
              >
                <p className="font-semibold">{item.name}</p>
                <p className="mt-1 text-xs text-slate-500">{item.family ?? "Career role"}</p>
                <p className="mt-3 text-xs text-slate-500">{item.requirementCount} competency requirements</p>
              </button>
            );
          })}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Hours per week</span>
            <input
              type="number"
              min={1}
              max={80}
              value={hoursPerWeek}
              onChange={event => {
                setHoursPerWeek(Number(event.target.value));
                setGoalSaved(false);
              }}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Preferred session</span>
            <select
              value={preferredSessionMinutes}
              onChange={event => {
                setPreferredSessionMinutes(Number(event.target.value));
                setGoalSaved(false);
              }}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            >
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>60 minutes</option>
              <option value={90}>90 minutes</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Target date · optional</span>
            <input
              type="date"
              value={targetDate}
              onChange={event => {
                setTargetDate(event.target.value);
                setGoalSaved(false);
              }}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>
        </div>

        <div className="mt-5">
          <p className="text-sm font-medium text-slate-700">Learning days</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DAYS.map(day => {
              const active = learningDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={[
                    "rounded-lg border px-3 py-2 text-sm font-medium",
                    active ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-300 text-slate-600"
                  ].join(" ")}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        <label className="mt-5 block max-w-sm">
          <span className="text-sm font-medium text-slate-700">Roadmap adaptation</span>
          <select
            value={adaptationMode}
            onChange={event => {
              setAdaptationMode(event.target.value as "AUTOMATIC" | "ASK_FIRST");
              setGoalSaved(false);
            }}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
          >
            <option value="AUTOMATIC">Update automatically when evidence justifies it</option>
            <option value="ASK_FIRST">Ask before applying plan changes</option>
          </select>
        </label>

        <button
          type="button"
          onClick={saveGoal}
          disabled={saving || !selectedRole || learningDays.length === 0}
          className="mt-6 rounded-xl bg-brand-600 px-5 py-2.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving..." : goalSaved ? "Update career goal" : "Save career goal"}
        </button>

        {message ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{message}</p>
        ) : null}
      </section>

      <section className={goalSaved ? "" : "pointer-events-none opacity-50"}>
        <div className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Step 2 · Evidence</p>
          <h2 className="mt-1 text-xl font-semibold">Upload your resume</h2>
          <p className="mt-2 text-sm text-slate-600">
            Resume evidence is mapped into your persistent SkillTwin, then compared with {role?.name ?? "your selected role"}.
          </p>
        </div>
        <ResumeAnalyzer />
        {!goalSaved ? (
          <p className="mt-3 text-sm text-amber-700">Save your target role before analyzing your resume.</p>
        ) : null}
      </section>
    </div>
  );
}
