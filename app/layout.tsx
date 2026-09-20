import type { Metadata } from "next";
import "./globals.css";
import { AppNav } from "@/components/shell/app-nav";
import { ProductRealtimeSync } from "@/components/realtime/product-sync";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "SkillTwin",
  description: "A learning agent that evolves as you do."
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-950 antialiased">
        <AppNav />
        {data.user ? <ProductRealtimeSync userId={data.user.id} /> : null}
        {children}
      </body>
    </html>
  );
}
