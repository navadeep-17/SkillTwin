export default function Loading() {
  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="max-w-2xl">
        <div className="skeleton h-3 w-24 rounded-full" />
        <div className="skeleton mt-4 h-9 w-72 max-w-full rounded-xl" />
        <div className="skeleton mt-3 h-4 w-[28rem] max-w-full rounded-lg" />
      </div>

      <section className="mt-8 surface-card p-6 sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.25fr_.75fr]">
          <div>
            <div className="skeleton h-4 w-32 rounded-lg" />
            <div className="skeleton mt-5 h-12 w-80 max-w-full rounded-xl" />
            <div className="skeleton mt-3 h-5 w-[32rem] max-w-full rounded-lg" />
            <div className="mt-7 flex gap-3">
              <div className="skeleton h-10 w-36 rounded-xl" />
              <div className="skeleton h-10 w-28 rounded-xl" />
            </div>
          </div>
          <div className="flex items-center justify-center">
            <div className="skeleton size-40 rounded-full" />
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map(item => (
          <div key={item} className="surface-card p-5">
            <div className="skeleton h-3 w-28 rounded-lg" />
            <div className="skeleton mt-4 h-8 w-20 rounded-lg" />
            <div className="skeleton mt-3 h-3 w-36 max-w-full rounded-lg" />
          </div>
        ))}
      </div>
    </main>
  );
}
