import { createClient } from "@/lib/supabase/server";
import { GlobalAgentToolsClient } from "@/components/shell/global-agent-tools-client";

export async function GlobalAgentTools(){
  const supabase=await createClient();
  const {data}=await supabase.auth.getUser();
  if(!data.user) return null;
  return <GlobalAgentToolsClient />;
}
