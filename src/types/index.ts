// ---------------------------------------------------------------------------
// Model identifiers
// ---------------------------------------------------------------------------

export const MODEL_IDS = {
  CLAUDE: "claude",
  GPT: "gpt",
  GEMINI: "gemini",
} as const;

export type ModelId = (typeof MODEL_IDS)[keyof typeof MODEL_IDS];

// ---------------------------------------------------------------------------
// Multi-modal content blocks
// ---------------------------------------------------------------------------

export interface TextContent {
  type: "text";
  text: string;
}

export interface ImageContent {
  type: "image";
  /** Base-64 encoded image data */
  data: string;
  mimeType: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
}

export interface FileContent {
  type: "file";
  /** Base-64 encoded file data */
  data: string;
  mimeType: string;
  fileName: string;
}

export type ContentBlock = TextContent | ImageContent | FileContent;

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export interface Message {
  role: "user" | "assistant" | "system";
  content: ContentBlock[];
}

// ---------------------------------------------------------------------------
// Chat request / response
// ---------------------------------------------------------------------------

export interface ChatRequest {
  /** Which model to route the conversation to */
  model: ModelId;
  messages: Message[];

  /** Optional: override which model runs the safety check (default: gpt) */
  safetyModel?: ModelId;
  /** Optional: supply a custom safety prompt instead of the built-in default */
  safetyPrompt?: string;
  /** Optional: disable the safety layer entirely (e.g. for internal testing) */
  skipSafety?: boolean;
}

export interface ChatResponse {
  id: string;
  model: ModelId;
  message: Message;
  safety: {
    inputCheck: SafetyResult;
    outputCheck: SafetyResult;
  };
}

// ---------------------------------------------------------------------------
// Safety
// ---------------------------------------------------------------------------

export interface SafetyResult {
  safe: boolean;
  /** Human-readable explanation when content is flagged */
  reason?: string;
  /** The model that performed the safety check */
  checkedBy: ModelId;
}

export interface SafetyConfig {
  /** Model used for the LLM-based safety check (default: gpt) */
  model: ModelId;
  /** The system prompt sent to the safety-check model */
  prompt: string;
}

// ---------------------------------------------------------------------------
// Model provider interface
// ---------------------------------------------------------------------------

export interface ModelProvider {
  readonly id: ModelId;

  /**
   * Send a conversation to the model and return the assistant response.
   * Providers must translate between the generic ContentBlock format and
   * whatever the underlying API expects.
   */
  chat(messages: Message[]): Promise<Message>;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class SafetyViolationError extends Error {
  constructor(
    public readonly result: SafetyResult,
    public readonly phase: "input" | "output",
  ) {
    super(
      `Safety violation (${phase}): ${result.reason ?? "content flagged"}`,
    );
    this.name = "SafetyViolationError";
  }
}

export class ProviderError extends Error {
  constructor(
    public readonly provider: ModelId,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(`[${provider}] ${message}`);
    this.name = "ProviderError";
  }
}

export class ValidationError extends Error {
  constructor(
    public readonly issues: Array<{ message: string; path: (string | number)[] }>,
  ) {
    super(`Validation failed: ${issues.map((i) => i.message).join(", ")}`);
    this.name = "ValidationError";
  }
}
