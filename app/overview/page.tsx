import { runVerticalSlice } from "@/lib/domain/demo";

export default function OverviewPage() {
  const result = runVerticalSlice();
  const restBefore = result.before.skills.find(skill => skill.skillId === "rest-api");
  const restAfter = result.after.skills.find(skill => skill.skillId === "rest-api");

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">Backend Engineer · Demo Twin</p>
        <h1 className="mt-2 text-3xl font-semibold">SkillTwin overview</h1>
        <p className="mt-2 text-slate-600">The deterministic vertical slice is live before database integration.</p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Metric label="Career readiness" value={result.before.readiness + "%"} detail={"After validation: " + result.after.readiness + "%"} />
        <Metric label="REST capability" value={restBefore?.level ?? "UNKNOWN"} detail={"After validation: " + (restAfter?.level ?? "UNKNOWN")} />
        <Metric label="REST confidence" value={Math.round((restBefore?.confidence ?? 0) * 100) + "%"} detail={"After validation: " + Math.round((restAfter?.confidence ?? 0) * 100) + "%"} />
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Agent adaptation</p>
            <h2 className="mt-1 text-xl font-semibold">Roadmap changed because evidence changed</h2>
          </div>
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">
            Plan v{result.planDiff.fromVersion} → v{result.planDiff.toVersion}
          </span>
        </div>
        <p className="mt-4 text-slate-600">{result.planDiff.reason}</p>
        <div className="mt-5 grid gap-3">
          {result.planDiff.operations.map((operation, index) => (
            <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <span className="font-semibold">{operation.type}</span>
              <span className="ml-2 text-slate-600">{operation.reason}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{detail}</p>
    </div>
  );
}
