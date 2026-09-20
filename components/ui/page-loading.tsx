export function ProductPageLoading({
  variant = "dashboard"
}: {
  variant?: "dashboard" | "graph" | "list";
}) {
  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-6 lg:px-8 lg:py-10" aria-busy="true" aria-label="Loading page">
      <div className="flex items-start justify-between gap-4">
        <div className="max-w-2xl flex-1">
          <div className="skeleton h-3 w-24 rounded-full" />
          <div className="skeleton mt-4 h-9 w-72 max-w-full rounded-xl" />
          <div className="skeleton mt-3 h-4 w-[30rem] max-w-full rounded-lg" />
        </div>
        <div className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-400 shadow-sm">
          <span className="size-2 rounded-full bg-brand-400 loading-dot" />
          Syncing your SkillTwin
        </div>
      </div>

      {variant === "graph" ? (
        <section className="surface-card mt-7 overflow-hidden">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <div className="skeleton h-4 w-36 rounded-lg" />
            <div className="skeleton mt-3 h-6 w-64 rounded-lg" />
          </div>
          <div className="grid min-h-[520px] lg:grid-cols-[1fr_280px]">
            <div className="relative overflow-hidden bg-slate-50">
              {[0, 1, 2, 3, 4, 5].map((item) => (
                <div
                  key={item}
                  className="skeleton absolute h-24 w-48 rounded-2xl"
                  style={{
                    left: 8 + (item % 3) * 31 + "%",
                    top: 12 + Math.floor(item / 3) * 44 + "%"
                  }}
                />
              ))}
            </div>
            <div className="border-t border-slate-100 p-5 lg:border-l lg:border-t-0">
              <div className="skeleton h-3 w-24 rounded-full" />
              <div className="skeleton mt-4 h-7 w-44 rounded-lg" />
              <div className="mt-6 space-y-3">
                {[0, 1, 2, 3].map(item => <div key={item} className="skeleton h-10 w-full rounded-xl" />)}
              </div>
            </div>
          </div>
        </section>
      ) : variant === "list" ? (
        <div className="mt-7 space-y-4">
          {[0, 1, 2].map(item => (
            <section key={item} className="surface-card p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="skeleton h-4 w-28 rounded-lg" />
                  <div className="skeleton mt-3 h-6 w-56 max-w-full rounded-lg" />
                </div>
                <div className="skeleton h-8 w-24 rounded-xl" />
              </div>
              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {[0, 1, 2, 3].map(row => <div key={row} className="skeleton h-28 rounded-xl" />)}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <>
          <section className="surface-card mt-7 p-6 sm:p-8">
            <div className="grid items-center gap-8 lg:grid-cols-[1.25fr_.75fr]">
              <div>
                <div className="skeleton h-4 w-36 rounded-lg" />
                <div className="skeleton mt-5 h-12 w-96 max-w-full rounded-xl" />
                <div className="skeleton mt-3 h-5 w-[34rem] max-w-full rounded-lg" />
                <div className="mt-7 flex gap-3">
                  <div className="skeleton h-10 w-36 rounded-xl" />
                  <div className="skeleton h-10 w-28 rounded-xl" />
                </div>
              </div>
              <div className="flex items-center justify-center">
                <div className="skeleton size-44 rounded-full" />
              </div>
            </div>
          </section>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map(item => (
              <div key={item} className="surface-card p-5">
                <div className="skeleton h-3 w-28 rounded-lg" />
                <div className="skeleton mt-4 h-8 w-20 rounded-lg" />
                <div className="skeleton mt-3 h-3 w-36 max-w-full rounded-lg" />
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
