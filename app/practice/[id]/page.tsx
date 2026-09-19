import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChallengeSession } from "@/components/practice/challenge-session";

export default async function ChallengePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const { id } = await params;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <ChallengeSession assessmentId={id} />
    </main>
  );
}
