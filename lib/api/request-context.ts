import { randomUUID } from "node:crypto";
import { headers } from "next/headers";

export async function getRequestId(): Promise<string> {
  const h = await headers();
  return h.get("x-request-id") ?? randomUUID();
}
