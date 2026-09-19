export interface ApiUiEffects {
  notifications?: Array<{ title: string; message?: string; tone?: "info" | "success" | "warning" | "error" }>;
  skill_delta?: unknown[];
  plan_diff?: unknown;
  next_action?: { type: string; label: string; href?: string; entityId?: string };
}

export interface ApiEnvelope<T> {
  ok: true;
  data: T;
  ui_effects?: ApiUiEffects;
  meta: { request_id: string; server_time: string };
}

export interface ApiErrorEnvelope {
  ok: false;
  error: { code: string; message: string; field_errors?: Record<string, string[]> };
  meta: { request_id: string };
}
