"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

const TABLES = [
  "user_skills",
  "gap_snapshots",
  "learning_plans",
  "skill_assessments",
  "plan_diffs",
  "agent_events",
  "profile_analysis_runs"
] as const;

export function ProductRealtimeSync({ userId }: { userId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        router.refresh();
      }, 180);
    };

    let channel = supabase.channel("skilltwin-live-" + userId);

    for (const table of TABLES) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: "user_id=eq." + userId
        },
        scheduleRefresh
      );
    }

    channel.subscribe();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [router, userId]);

  return null;
}
