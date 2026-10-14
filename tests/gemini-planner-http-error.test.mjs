import test from "node:test";
import assert from "node:assert/strict";
import { classifyGeminiPlannerHttpError } from "../lib/domain/gemini-planner-http-error.ts";
test("Google errors reduce to safe, actionable categories",()=>{
  const failure = msg => ({error:{message:msg}});
  assert.equal(classifyGeminiPlannerHttpError(400,failure("Invalid JSON payload received. Unknown name 'thinkingConfig'")),"thinking_parameter");
  assert.equal(classifyGeminiPlannerHttpError(400,failure("Invalid JSON payload received. Unknown name 'responseFormat'")),"response_schema");
  assert.equal(classifyGeminiPlannerHttpError(400,failure("Unsupported model: gemini-3.5-flash-lite")),"model_unavailable");
  assert.equal(classifyGeminiPlannerHttpError(400,failure("API key not valid: confidential")),"key_rejected");
  assert.equal(classifyGeminiPlannerHttpError(400,failure("Invalid JSON payload received. Unknown name 'foobar'")),"invalid_request_field");
  assert.equal(classifyGeminiPlannerHttpError(429,null),"rate_limited");
  assert.equal(classifyGeminiPlannerHttpError(503,null),"upstream_unavailable");
});
test("raw errors containing sensitive text are never returned",()=>{
  const sensitive="private resume data and a fake-api-key-1234";
  const tag=classifyGeminiPlannerHttpError(400,{error:{message:sensitive}});
  assert.equal(tag,"bad_request");
  assert.equal(tag.includes(sensitive),false);
});
