import { ModelProvider } from "../types";
import { ModelProviderBase } from "./base";
import { ClaudeProvider } from "./claude";
import { GptProvider } from "./gpt";
import { GeminiProvider } from "./gemini";

/** Singleton registry of provider instances. */
const providers: Record<ModelProvider, ModelProviderBase> = {
  claude: new ClaudeProvider(),
  gpt: new GptProvider(),
  gemini: new GeminiProvider(),
};

/**
 * Resolve a provider name to its implementation.
 * Throws if the provider is not recognized.
 */
export function getProvider(name: ModelProvider): ModelProviderBase {
  const provider = providers[name];
  if (!provider) {
    throw new Error(`Unknown model provider: ${name}`);
  }
  return provider;
}
