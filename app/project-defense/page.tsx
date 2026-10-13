import {redirect} from "next/navigation";
import Link from "next/link";
import {createClient} from "@/lib/supabase/server";
import {ProjectDefenseWorkbench} from "@/components/projects/project-defense-workbench";

export const dynamic="force-dynamic";
export default async function ProjectDefensePage(){
  const supabase=await createClient();
  const {data}=await supabase.auth.getUser();
  if(!data.user)redirect("/login");
  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
      <Link href="/projects" className="quiet-link">← Back to Projects</Link>
      <ProjectDefenseWorkbench/>
    </main>
  );
}
