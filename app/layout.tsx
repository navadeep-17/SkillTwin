import type { Metadata } from "next";
import "./globals.css";
import { AppNav } from "@/components/shell/app-nav";
import { GlobalAssistantDock } from "@/components/shell/global-assistant-dock";
import { PageTransition } from "@/components/shell/page-transition";
import { RouteProgress } from "@/components/shell/route-progress";
import { ProductRealtimeSync } from "@/components/realtime/product-sync";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: {
    default: "SkillTwin — Adaptive Learning Agent",
    template: "%s · SkillTwin"
  },
  description: "Build an evidence-backed model of your skills, follow an adaptive roadmap, validate what you know, and see exactly why your plan changes.",
  applicationName: "SkillTwin",
  icons: {
    icon: "/icon.svg"
  }
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  return (
    <html lang="en">
      <body className="min-h-screen text-slate-950 antialiased">
        <RouteProgress />
        {user ? <AppNav userId={user.id} email={user.email} /> : null}
        {user ? <ProductRealtimeSync userId={user.id} /> : null}
        <div className={user ? "min-h-screen pb-20 lg:pb-0 lg:pl-64" : "min-h-screen"}>
          <PageTransition>{children}</PageTransition>
        </div>
        {user ? <GlobalAssistantDock /> : null}
      </body>
    </html>
  );
}
