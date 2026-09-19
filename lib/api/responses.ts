import { NextResponse } from "next/server";
import type { ApiEnvelope, ApiErrorEnvelope, ApiUiEffects } from "./envelope";

export function ok<T>(requestId: string, data: T, uiEffects?: ApiUiEffects, status = 200) {
  const body: ApiEnvelope<T> = {
    ok: true,
    data,
    ...(uiEffects ? { ui_effects: uiEffects } : {}),
    meta: { request_id: requestId, server_time: new Date().toISOString() }
  };
  return NextResponse.json(body, { status });
}

export function fail(
  requestId: string,
  status: number,
  code: string,
  message: string,
  fieldErrors?: Record<string, string[]>
) {
  const body: ApiErrorEnvelope = {
    ok: false,
    error: { code, message, ...(fieldErrors ? { field_errors: fieldErrors } : {}) },
    meta: { request_id: requestId }
  };
  return NextResponse.json(body, { status });
}
