import { ContentPart } from "./content";
import { SafetyConfig, LLMSafetyConfig } from "./safety";

/** Supported model providers. */
export type ModelProvider = "claude" | "gpt" | "gemini";

/** Specific model identifiers within each provider. */
export type ModelId =
  | "claude-sonnet-4-20250514"
  | "claude-haiku-4-20250414"
  | "gpt-4o"
  | "gpt-4o-mini"
  | "gemini-2.0-flash"
  | "gemini-2.5-pro";

export interface ModelSpec {
  provider: ModelProvider;
  modelId: ModelId;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: ContentPart[];
}

export interface ChatRequest {
  /** Unique conversation ID for multi-turn context. */
  conversationId?: string;
  /** Which model to use. */
  model: ModelSpec;
  /** Conversation history + new user message. */
  messages: ChatMessage[];
  /**
   * Optional safety overrides.
   * Merged with DEFAULT_SAFETY_CONFIG; cannot weaken platform minimums.
   */
  safetyConfig?: Partial<SafetyConfig>;
  /** Optional temperature (0-1). */
  temperature?: number;
}

export interface ChatResponse {
  conversationId: string;
  model: ModelSpec;
  message: ChatMessage;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  /** Safety metadata — which checks ran and what was flagged. */
  safetyMeta: {
    inputCheckPassed: boolean;
    outputCheckPassed: boolean;
    flaggedTopics: string[];
    /** Which safety layers ran. */
    layersRun: ("keyword" | "llm")[];
    /** Which layer caught the issue, if any. */
    flaggedBy?: "keyword" | "llm";
  };
}

export interface ChatErrorResponse {
  error: {
    code: string;
    message: string;
  };
}
