import { ChatMessage, ModelSpec, SafetyConfig } from "../types";

/** Token usage returned by a provider call. */
export interface ProviderUsage {
  inputTokens: number;
  outputTokens: number;
}

/** Standardized result from any model provider. */
export interface ProviderResponse {
  message: ChatMessage;
  usage?: ProviderUsage;
}

/**
 * Abstract base that every model provider must implement.
 *
 * Providers are responsible for:
 *  - Translating our generic ChatMessage format into the vendor-specific API shape
 *  - Making the HTTP call to the vendor
 *  - Translating the vendor response back into our generic format
 *
 * They are NOT responsible for safety filtering — that happens in the
 * orchestration layer before and after the provider call.
 */
export abstract class ModelProviderBase {
  abstract readonly providerName: string;

  /**
   * Send messages to the model and return a response.
   *
   * @param messages  Conversation history (already safety-checked).
   * @param model     Which specific model to call.
   * @param config    Merged safety config — providers use maxOutputTokens and
   *                  the systemPromptPrefix from here.
   * @param temperature Optional temperature override.
   */
  abstract chat(
    messages: ChatMessage[],
    model: ModelSpec,
    config: SafetyConfig,
    temperature?: number
  ): Promise<ProviderResponse>;
}
