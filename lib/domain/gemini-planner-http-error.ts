/** Only low-cardinality categories are emitted from upstream AI errors.
 * Never log the raw Google response body: it might include user content or secrets.
 */
export function classifyGeminiPlannerHttpError(status: number, body: unknown): string {
  const error = body && typeof body === "object" && !Array.isArray(body)
    ? (body as { error?: { message?: unknown; status?: unknown } }).error : undefined;
  const message = typeof error?.message === "string" ? error.message.slice(0, 1500).toLowerCase() : "";
  if (status === 400) {
    if (/api.?key (is )?not valid|api_key_invalid|invalid api key/.test(message)) return "key_rejected";
    if (/model/.test(message) && /unavailable|not found|not supported|unsupported|not available/.test(message))
      return "model_unavailable";
    if (/thinking|thinkinglevel|thinking_level/.test(message)) return "thinking_parameter";
    if (/temperature/.test(message)) return "temperature_parameter";
    if (/response.?format|response.?json.?schema|response.?mime.?type|schema|mime.?type/.test(message))
      return "response_schema";
    if (/unknown name|unknown field|unknown parameter|invalid json payload|unrecognized field/.test(message))
      return "invalid_request_field";
    return "bad_request";
  }
  if (status === 401 || status === 403) return "access_denied";
  if (status === 404) return "model_not_found";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "upstream_unavailable";
  return "upstream_error";
}
