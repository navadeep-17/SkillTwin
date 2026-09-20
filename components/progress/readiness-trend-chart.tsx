"use client";

import { useState } from "react";

export type ReadinessSnapshot = {
  id: string;
  readiness: number;
  coverage: number;
  createdAt: string;
};

export function ReadinessTrendChart({ snapshots }: { snapshots: ReadinessSnapshot[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const width = 800;
  const height = 220;
  const insetX = 28;
  const insetY = 24;
  const plotWidth = width - insetX * 2;
  const plotHeight = height - insetY * 2;

  function point(snapshot: ReadinessSnapshot, index: number, key: "readiness" | "coverage") {
    const x = snapshots.length === 1
      ? width / 2
      : insetX + (index / (snapshots.length - 1)) * plotWidth;
    const y = insetY + (1 - Math.max(0, Math.min(100, snapshot[key])) / 100) * plotHeight;
    return { x, y };
  }

  function points(key: "readiness" | "coverage") {
    return snapshots.map((snapshot, index) => {
      const current = point(snapshot, index, key);
      return current.x + "," + current.y;
    }).join(" ");
  }

  const active = activeIndex == null ? null : snapshots[activeIndex];
  const activeReadiness = active && activeIndex != null ? point(active, activeIndex, "readiness") : null;
  const activeCoverage = active && activeIndex != null ? point(active, activeIndex, "coverage") : null;
  const tooltipX = activeReadiness ? (activeReadiness.x / width) * 100 : 50;
  const tooltipTransform = activeIndex === 0
    ? "translateX(0)"
    : activeIndex === snapshots.length - 1
      ? "translateX(-100%)"
      : "translateX(-50%)";

  return (
    <div className="mt-6">
      <div className="overflow-x-auto pb-1">
        <div className="relative min-w-[620px]">
          {active && activeReadiness ? (
            <div
              className="pointer-events-none absolute top-1 z-20 min-w-44 rounded-xl border border-slate-200 bg-white/95 px-3 py-2.5 text-xs shadow-lift backdrop-blur"
              style={{ left: tooltipX + "%", transform: tooltipTransform }}
              role="status"
            >
              <p className="font-semibold text-slate-800">
                {new Date(active.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </p>
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center justify-between gap-5">
                  <span className="inline-flex items-center gap-1.5 text-slate-500">
                    <span className="size-2 rounded-full bg-brand-500" />
                    Readiness
                  </span>
                  <span className="font-semibold text-slate-900">{Math.round(active.readiness)}%</span>
                </div>
                <div className="flex items-center justify-between gap-5">
                  <span className="inline-flex items-center gap-1.5 text-slate-500">
                    <span className="size-2 rounded-full bg-slate-400" />
                    Evidence
                  </span>
                  <span className="font-semibold text-slate-900">{Math.round(active.coverage)}%</span>
                </div>
              </div>
            </div>
          ) : null}

          <svg
            viewBox={"0 0 " + width + " " + height}
            className="h-56 w-full"
            role="img"
            aria-label="Readiness and evidence coverage trend. Focus or hover a point for exact values."
            onMouseLeave={() => setActiveIndex(null)}
          >
            {[0, 25, 50, 75, 100].map(value => {
              const y = insetY + (1 - value / 100) * plotHeight;
              return (
                <g key={value}>
                  <line x1={insetX} y1={y} x2={width - insetX} y2={y} stroke="#EAECF0" strokeWidth="1" />
                  <text x="0" y={y + 4} fontSize="10" fill="#98A2B3">{value}</text>
                </g>
              );
            })}

            <polyline
              pathLength={1}
              className="chart-line-draw"
              points={points("coverage")}
              fill="none"
              stroke="#98A2B3"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              pathLength={1}
              className="chart-line-draw chart-line-draw-delayed"
              points={points("readiness")}
              fill="none"
              stroke="#5B5CE2"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {activeReadiness ? (
              <line
                x1={activeReadiness.x}
                y1={insetY}
                x2={activeReadiness.x}
                y2={height - insetY}
                stroke="#D0D5DD"
                strokeWidth="1"
                strokeDasharray="4 5"
              />
            ) : null}

            {snapshots.map((snapshot, index) => {
              const readiness = point(snapshot, index, "readiness");
              const coverage = point(snapshot, index, "coverage");
              const hitWidth = snapshots.length === 1 ? plotWidth : Math.max(34, plotWidth / Math.max(1, snapshots.length - 1));

              return (
                <g key={snapshot.id}>
                  <rect
                    x={Math.max(insetX, readiness.x - hitWidth / 2)}
                    y={insetY}
                    width={Math.min(hitWidth, width - insetX - Math.max(insetX, readiness.x - hitWidth / 2))}
                    height={plotHeight}
                    fill="transparent"
                    tabIndex={0}
                    role="button"
                    aria-label={
                      new Date(snapshot.createdAt).toLocaleDateString() +
                      ": readiness " + Math.round(snapshot.readiness) +
                      "%, evidence coverage " + Math.round(snapshot.coverage) + "%"
                    }
                    onMouseEnter={() => setActiveIndex(index)}
                    onFocus={() => setActiveIndex(index)}
                    onBlur={() => setActiveIndex(null)}
                  />
                  <circle
                    className="chart-dot-in pointer-events-none"
                    style={{ animationDelay: 240 + index * 55 + "ms" }}
                    cx={coverage.x}
                    cy={coverage.y}
                    r={activeIndex === index ? "4.5" : "3.5"}
                    fill="#98A2B3"
                    stroke="white"
                    strokeWidth="2"
                  />
                  <circle
                    className="chart-dot-in pointer-events-none"
                    style={{ animationDelay: 280 + index * 55 + "ms" }}
                    cx={readiness.x}
                    cy={readiness.y}
                    r={activeIndex === index ? "6" : "4.5"}
                    fill="#5B5CE2"
                    stroke="white"
                    strokeWidth="2"
                  />
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <div className="mt-1 flex gap-6 overflow-x-auto pb-1">
        {snapshots.map((snapshot, index) => (
          <button
            type="button"
            key={snapshot.id}
            onMouseEnter={() => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
            onFocus={() => setActiveIndex(index)}
            onBlur={() => setActiveIndex(null)}
            className={
              "min-w-20 rounded-lg px-2 py-1.5 text-center transition " +
              (activeIndex === index ? "bg-brand-50" : "hover:bg-slate-50")
            }
          >
            <p className="text-xs font-semibold text-slate-700">{Math.round(snapshot.readiness)}%</p>
            <p className="mt-0.5 text-[10px] text-slate-400">
              {new Date(snapshot.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
