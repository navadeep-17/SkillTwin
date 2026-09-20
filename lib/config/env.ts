import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().default("http://127.0.0.1:54321"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).default("local-anon-key-not-configured")
});

const serverSchema = publicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SUPABASE_DB_URL: z.string().min(1).optional(),
  AI_PROVIDER: z.enum(["openai", "gemini"]).default("gemini"),
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().min(1).default("gemini-3.8-flash"),
  DEMO_FALLBACK_ENABLED: z.enum(["true", "false"]).default("true"),
  DEMO_RESET_SECRET: z.string().min(16).optional()
});

function value(name:string) {
  const raw=process.env[name];
  return raw && raw.trim() ? raw : undefined;
}

export function getPublicEnv() {
  return publicSchema.parse({
    NEXT_PUBLIC_APP_URL: value("NEXT_PUBLIC_APP_URL"),
    NEXT_PUBLIC_SUPABASE_URL: value("NEXT_PUBLIC_SUPABASE_URL"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: value("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  });
}

export function getServerEnv() {
  return serverSchema.parse({
    NEXT_PUBLIC_APP_URL: value("NEXT_PUBLIC_APP_URL"),
    NEXT_PUBLIC_SUPABASE_URL: value("NEXT_PUBLIC_SUPABASE_URL"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: value("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    SUPABASE_SERVICE_ROLE_KEY: value("SUPABASE_SERVICE_ROLE_KEY"),
    SUPABASE_DB_URL: value("SUPABASE_DB_URL"),
    AI_PROVIDER: value("AI_PROVIDER"),
    OPENAI_API_KEY: value("OPENAI_API_KEY"),
    GEMINI_API_KEY: value("GEMINI_API_KEY"),
    GEMINI_MODEL: value("GEMINI_MODEL"),
    DEMO_FALLBACK_ENABLED: value("DEMO_FALLBACK_ENABLED"),
    DEMO_RESET_SECRET: value("DEMO_RESET_SECRET")
  });
}
