import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SparksWalletView } from "@/components/sparks/sparks-wallet-view";
export const dynamic = "force-dynamic";
export default async function SparksPage() {
  const client = await createClient();
  const {data} = await client.auth.getUser();
  if (!data.user) redirect("/login?next=%2Fsparks");
  return <main className="mx-auto max-w-4xl px-5 py-8 sm:px-8"><SparksWalletView /></main>;
}
