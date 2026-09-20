"use client";

import { useState } from "react";
import { Bell, CalendarDays, Gauge, Save, Sparkles } from "lucide-react";

type InitialSettings = {
  notifications_enabled: boolean;
  weekly_report_enabled: boolean;
  reduced_motion: boolean;
  compact_density: boolean;
};

export function LearningSettingsForm({ initial }: { initial: InitialSettings }) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(initial.notifications_enabled);
  const [weeklyReportEnabled, setWeeklyReportEnabled] = useState(initial.weekly_report_enabled);
  const [reducedMotion, setReducedMotion] = useState(initial.reduced_motion);
  const [compactDensity, setCompactDensity] = useState(initial.compact_density);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    if (pending) return;
    setPending(true);
    setMessage("");

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationsEnabled,
          weeklyReportEnabled,
          reducedMotion,
          compactDensity
        })
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setMessage(payload.error?.message ?? "Could not save settings.");
        return;
      }

      setMessage("Settings saved.");
      document.documentElement.dataset.reduceMotion = reducedMotion ? "true" : "false";
      document.documentElement.dataset.compactDensity = compactDensity ? "true" : "false";
    } catch {
      setMessage("Could not save settings.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="surface-card overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
        <p className="eyebrow">Preferences</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Learning experience</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          These settings affect how SkillTwin presents updates and summaries. They never change evidence weighting or role-readiness math.
        </p>
      </div>

      <div className="divide-y divide-slate-100 px-5 sm:px-6">
        <SettingRow
          icon={Bell}
          title="Product notifications"
          detail="Show important in-app updates when SkillTwin changes."
          checked={notificationsEnabled}
          onChange={setNotificationsEnabled}
        />
        <SettingRow
          icon={CalendarDays}
          title="Weekly progress report"
          detail="Keep the weekly evidence-backed progress summary enabled."
          checked={weeklyReportEnabled}
          onChange={setWeeklyReportEnabled}
        />
        <SettingRow
          icon={Sparkles}
          title="Reduce motion"
          detail="Prefer restrained transitions and avoid movement-heavy UI."
          checked={reducedMotion}
          onChange={setReducedMotion}
        />
        <SettingRow
          icon={Gauge}
          title="Compact density"
          detail="Use tighter spacing for information-dense screens."
          checked={compactDensity}
          onChange={setCompactDensity}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-5 py-4 sm:px-6">
        <button type="button" onClick={() => void save()} disabled={pending} className="btn-primary">
          <Save className="size-4" />
          {pending ? "Saving" : "Save settings"}
        </button>
        {message ? <span className="text-sm text-slate-500">{message}</span> : null}
      </div>
    </div>
  );
}

function SettingRow({
  icon: Icon,
  title,
  detail,
  checked,
  onChange
}: {
  icon: typeof Bell;
  title: string;
  detail: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-5 py-5">
      <span className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          <Icon className="size-4" />
        </span>
        <span>
          <span className="block text-sm font-semibold text-slate-900">{title}</span>
          <span className="mt-1 block text-xs leading-5 text-slate-500">{detail}</span>
        </span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={event => onChange(event.target.checked)}
        className="size-5 shrink-0 accent-indigo-600"
      />
    </label>
  );
}
