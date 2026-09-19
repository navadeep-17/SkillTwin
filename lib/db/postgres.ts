import "server-only";
import postgres, { type Sql } from "postgres";
import { getServerEnv } from "@/lib/config/env";

let client: Sql | null = null;

export function getSql(): Sql {
  if (client) return client;
  const connectionString = getServerEnv().SUPABASE_DB_URL;
  if (!connectionString) throw new Error("SUPABASE_DB_URL is required for transactional domain writes");

  client = postgres(connectionString, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false
  });
  return client;
}
