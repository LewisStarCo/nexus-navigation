import type { AIPlannerSettings, AIProvider, ProviderConfig } from "@/src/shared/types";

export type ProviderProtocol = "openai-compatible" | "anthropic" | "gemini";

export interface ProviderDefinition {
  id: AIProvider;
  baseUrl: string;
  defaultModel: string;
  protocol: ProviderProtocol;
}

export const PROVIDERS: Readonly<Record<string, ProviderDefinition>> = Object.freeze({
  OpenAI: { id: "OpenAI", baseUrl: "https://api.openai.com/v1", defaultModel: "gpt-4.1-mini", protocol: "openai-compatible" },
  Qwen: { id: "Qwen", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", defaultModel: "qwen-plus", protocol: "openai-compatible" },
  "智谱 AI": { id: "智谱 AI", baseUrl: "https://open.bigmodel.cn/api/paas/v4", defaultModel: "glm-4.5-flash", protocol: "openai-compatible" },
  DeepSeek: { id: "DeepSeek", baseUrl: "https://api.deepseek.com", defaultModel: "deepseek-chat", protocol: "openai-compatible" },
  Claude: { id: "Claude", baseUrl: "https://api.anthropic.com/v1", defaultModel: "claude-sonnet-4-5", protocol: "anthropic" },
  Gemini: { id: "Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta", defaultModel: "gemini-2.5-flash", protocol: "gemini" },
});

function requireHttpsBaseUrl(value: string): string {
  const baseUrl = value.trim().replace(/\/$/, "");
  const url = new URL(baseUrl);
  if (url.protocol !== "https:") {
    throw new TypeError("AI Provider API Base URL must use HTTPS.");
  }
  return baseUrl;
}

export function resolveProviderConfig(
  settings: AIPlannerSettings,
): Omit<ProviderConfig, "baseUrl"> & { baseUrl: string; protocol: ProviderProtocol } {
  if (settings.provider === "Custom") {
    const modelId = settings.customProvider.model.trim() || settings.model.trim();
    if (!modelId) throw new TypeError("Custom Provider model ID is required.");
    return {
      provider: "Custom",
      name: settings.customProvider.name.trim() || "Custom Provider",
      apiKey: settings.apiKey,
      modelId,
      baseUrl: requireHttpsBaseUrl(settings.customProvider.baseUrl),
      protocol: "openai-compatible",
    };
  }

  const definition = PROVIDERS[settings.provider];
  if (!definition) throw new TypeError(`Unsupported AI Provider: ${settings.provider}`);
  return {
    provider: settings.provider,
    apiKey: settings.apiKey,
    modelId: settings.model.trim() || definition.defaultModel,
    baseUrl: definition.baseUrl,
    protocol: definition.protocol,
  };
}

export function defaultModelForProvider(provider: AIProvider): string | undefined {
  return PROVIDERS[provider]?.defaultModel;
}
