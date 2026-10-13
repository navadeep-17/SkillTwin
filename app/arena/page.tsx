import type {Metadata} from "next";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {ArenaDuel} from "@/components/arena/arena-duel";

export const metadata:Metadata={
  title:"SkillTwin Arena | Random Skill Duels",
  description:"Match with a real learner for a live five-question coding or SQL practice quiz."
};
export const dynamic="force-dynamic";
export default async function ArenaPage(){
  const supabase=await createClient();
  const {data}=await supabase.auth.getUser();
  if(!data.user)redirect("/login");
  return <ArenaDuel/>;
}
