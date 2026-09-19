import "server-only";
import { z } from "zod";
import { getServerEnv } from "@/lib/config/env";

type InteractionResponse = {
  status?: string;
  steps?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

function outputText(response: InteractionResponse) {
  const modelSteps = (response.steps ?? []).filter(step => step.type === "model_output");
  const last = modelSteps.at(-1);
  return (last?.content ?? [])
    .filter(item => item.type === "text" && typeof item.text === "string")
    .map(item => item.text)
    .join("");
}

export class GeminiStructuredClient {
  async generateJson<T>(input: {
    systemInstruction: string;
    prompt: string;
    jsonSchema: Record<string, unknown>;
    validator: z.ZodType<T>;
  }): Promise<T | null> {
    const env = getServerEnv();
    if (!env.GEMINI_API_KEY) return null;

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        model: env.GEMINI_MODEL,
        system_instruction: input.systemInstruction,
        input: input.prompt,
        store: false,
        generation_config: {
          temperature: 0.1,
          max_output_tokens: 2500
        },
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: input.jsonSchema
        }
      })
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error("GEMINI_INTERACTION_FAILED:" + response.status + ":" + body.slice(0, 300));
    }

    const interaction = await response.json() as InteractionResponse;
    if (interaction.status && interaction.status !== "completed") {
      throw new Error("GEMINI_INTERACTION_INCOMPLETE:" + interaction.status);
    }

    const text = outputText(interaction);
    if (!text) throw new Error("GEMINI_EMPTY_OUTPUT");

    const parsed = JSON.parse(text);
    return input.validator.parse(parsed);
  }
}

let client: GeminiStructuredClient | null = null;

export function getGeminiStructuredClient() {
  if (!client) client = new GeminiStructuredClient();
  return client;
}
