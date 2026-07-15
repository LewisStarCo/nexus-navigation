import type { AIPlannerSettings } from "@/src/shared/types";
import { resolveProviderConfig } from "../config/providers";
import { canUseAI, type AIUsagePurpose } from "../domain/permissions";

export interface AIRequestOptions {
  purpose: AIUsagePurpose;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  fetchImplementation?: typeof fetch;
}

export class AIPermissionError extends Error {
  constructor(readonly purpose: AIUsagePurpose) {
    super(`AI permission is disabled for ${purpose}.`);
    this.name = "AIPermissionError";
  }
}

function errorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const error = (payload as Record<string, unknown>).error;
  if (error && typeof error === "object") {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === "string") return message;
  }
  return fallback;
}

/**
 * Executes one user-requested AI call and returns text only. This service has
 * no access to Nexus storage, so it cannot save Events or alter Resources.
 */
export async function requestAIText(
  settings: AIPlannerSettings,
  options: AIRequestOptions,
): Promise<string> {
  if (!canUseAI(settings.permissions, options.purpose)) {
    throw new AIPermissionError(options.purpose);
  }
  if (!settings.apiKey.trim()) throw new TypeError("AI API Key is required.");
  if (!options.prompt.trim()) throw new TypeError("AI prompt is required.");

  const provider = resolveProviderConfig(settings);
  const request = options.fetchImplementation ?? fetch;
  let response: Response;
  let text = "";

  if (provider.protocol === "gemini") {
    response = await request(
      `${provider.baseUrl}/models/${encodeURIComponent(provider.modelId)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": provider.apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: options.prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: options.temperature ?? 0 },
        }),
      },
    );
    const payload = await response.json() as Record<string, unknown>;
    if (!response.ok) throw new Error(errorMessage(payload, "Gemini request failed."));
    const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
    const content = candidates[0] && typeof candidates[0] === "object"
      ? (candidates[0] as Record<string, unknown>).content
      : null;
    const parts = content && typeof content === "object" && Array.isArray((content as Record<string, unknown>).parts)
      ? (content as Record<string, unknown>).parts as Array<Record<string, unknown>>
      : [];
    text = typeof parts[0]?.text === "string" ? parts[0].text : "";
  } else if (provider.protocol === "anthropic") {
    response = await request(`${provider.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": provider.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: provider.modelId,
        max_tokens: options.maxTokens ?? 900,
        messages: [{ role: "user", content: options.prompt }],
      }),
    });
    const payload = await response.json() as Record<string, unknown>;
    if (!response.ok) throw new Error(errorMessage(payload, "Claude request failed."));
    const content = Array.isArray(payload.content) ? payload.content : [];
    text = content[0] && typeof content[0] === "object" && typeof (content[0] as Record<string, unknown>).text === "string"
      ? (content[0] as Record<string, unknown>).text as string
      : "";
  } else {
    response = await request(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}` },
      body: JSON.stringify({
        model: provider.modelId,
        messages: [{ role: "user", content: options.prompt }],
        temperature: options.temperature ?? 0,
      }),
    });
    const payload = await response.json() as Record<string, unknown>;
    if (!response.ok) throw new Error(errorMessage(payload, "AI request failed."));
    const choices = Array.isArray(payload.choices) ? payload.choices : [];
    const message = choices[0] && typeof choices[0] === "object"
      ? (choices[0] as Record<string, unknown>).message
      : null;
    text = message && typeof message === "object" && typeof (message as Record<string, unknown>).content === "string"
      ? (message as Record<string, unknown>).content as string
      : "";
  }

  if (!text.trim()) throw new Error("AI Provider returned an empty response.");
  return text;
}
