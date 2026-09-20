import type { Metadata } from "next";
import "./globals.css";
import { AppNav } from "@/components/shell/app-nav";
import { GlobalAssistantDock } from "@/components/shell/global-assistant-dock";
import { PageTransition } from "@/components/shell/page-transition";
import { ProductRealtimeSync } from "@/components/realtime/product-sync";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "SkillTwin",
  description: "A learning agent that evolves as you do."
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  return (
    <html lang="en">
      <body className="min-h-screen text-slate-950 antialiased">
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
