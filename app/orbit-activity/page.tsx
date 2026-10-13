import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {OrbitPreviewNav} from "@/components/orbit/orbit-preview-nav";
import {OrbitAgentActivity,type OrbitActivityEvent} from "./orbit-agent-activity";
import "../orbit-lab/orbit-lab.css";
import "./orbit-activity.css";

export const dynamic="force-dynamic";
export const metadata={
  title:"Agent Activity — SkillTwin Orbit",
  description:"An evidence-grounded, read-only timeline of committed SkillTwin agent events."
};

export default async function OrbitActivityPage(){
  const supabase=await createClient();
  const {data:auth,error:authError}=await supabase.auth.getUser();
  if(authError||!auth.user)redirect("/login?next=%2Forbit-activity");
  const {data,error}=await supabase.from("agent_events")
    .select("id,event_type,trigger_type,summary,entity_refs,evidence_refs,created_at")
    .eq("user_id",auth.user.id)
    .order("created_at",{ascending:false})
    .order("id",{ascending:false})
    .limit(60);
  if(error)throw error;
  // Only the event label, summary, timestamps and reference COUNTS cross to
  // the browser. IDs, raw metadata and evidence/entity identifiers stay private.
  const events:OrbitActivityEvent[]=(data??[]).map(row=>({
    id:String(row.id),
    eventType:String(row.event_type),
    triggerType:row.trigger_type?String(row.trigger_type):null,
    summary:String(row.summary),
    createdAt:String(row.created_at),
    evidenceCount:Array.isArray(row.evidence_refs)?row.evidence_refs.length:0,
    entityCount:Array.isArray(row.entity_refs)?row.entity_refs.length:0
  }));
  return <main className="orbit-lab orbit-activity">
    <OrbitPreviewNav/>
    <OrbitAgentActivity events={events}/>
  </main>;
}
