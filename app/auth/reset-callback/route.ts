import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL("/reset-password", url.origin));
    }
  }

  const target = new URL("/forgot-password", url.origin);
  target.searchParams.set("error", "Could not verify your password reset link. Please request a new one.");
  return NextResponse.redirect(target);
}
