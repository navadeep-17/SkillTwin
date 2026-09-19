import type { Metadata } from "next";
import "./globals.css";
import { AppNav } from "@/components/shell/app-nav";
import { GlobalAgentTools } from "@/components/shell/global-agent-tools";
import { AppAgentTools } from "@/components/shell/app-agent-tools";

export const metadata: Metadata = {
  title: "SkillTwin",
  description: "A learning agent that evolves as you do."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-950 antialiased"><AppNav />{children}<AppAgentTools /></body>
    </html>
  );
}
