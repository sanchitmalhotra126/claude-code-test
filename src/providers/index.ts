import { ModelProvider } from "../types";
import { ClaudeProvider } from "./claude";
import { GptProvider } from "./gpt";
import { GeminiProvider } from "./gemini";

export { ClaudeProvider, GptProvider, GeminiProvider };

/**
 * Default set of all model providers, constructed with environment-variable
 * API keys and standard model defaults.
 */
export const DEFAULT_PROVIDERS: ModelProvider[] = [
  new ClaudeProvider(),
  new GptProvider(),
  new GeminiProvider(),
];
