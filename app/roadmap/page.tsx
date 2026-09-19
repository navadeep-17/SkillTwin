import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RoadmapView } from "@/components/roadmap/roadmap-view";

export default async function RoadmapPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">Adaptive roadmap</p>
        <h1 className="mt-2 text-3xl font-semibold">Your learning plan</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          The roadmap is generated from your active gap snapshot, weekly capacity, prerequisite stages, and verified resource catalog.
        </p>
      </header>
      <RoadmapView />
    </main>
  );
}
