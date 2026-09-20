"use client";

import { useEffect, useState } from "react";

export function AnimatedReadinessRing({
  value,
  label = "role readiness",
  size = 188
}: {
  value: number;
  label?: string;
  size?: number;
}) {
  const target = Math.max(0, Math.min(100, value));
  const [display, setDisplay] = useState(0);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDisplay(target);
      return;
    }

    let frame = 0;
    const startedAt = performance.now();
    const duration = 780;

    function tick(now: number) {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(target * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  const dash = circumference * (display / 100);

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      aria-label={Math.round(target) + "% " + label}
      role="img"
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#EAECF0" strokeWidth="7" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#5B5CE2"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - dash}
          className="transition-[stroke-dashoffset] duration-150"
        />
      </svg>

      <div className="relative flex size-[78%] flex-col items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-100">
        <span className="text-4xl font-semibold tracking-tight text-slate-950">{Math.round(display)}%</span>
        <span className="mt-1 text-xs font-medium text-slate-500">{label}</span>
      </div>
    </div>
  );
}
