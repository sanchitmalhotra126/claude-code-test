import {
  ContentBlock,
  Message,
  ModelId,
  ModelProvider,
  MODEL_IDS,
  SafetyConfig,
  SafetyResult,
} from "../types";
import { DEFAULT_SAFETY_PROMPT } from "./prompts";

/**
 * Extracts a plain-text representation of content blocks for the safety model
 * to evaluate. Images are described by their metadata; files by name and type.
 */
function contentToPlainText(content: ContentBlock[]): string {
  return content
    .map((block) => {
      switch (block.type) {
        case "text":
          return block.text;
        case "image":
          return `[Image: ${block.mimeType}]`;
        case "file":
          return `[File: ${block.fileName} (${block.mimeType})]`;
      }
    })
    .join("\n");
}

/**
 * LLM-based content safety checker.
 *
 * Sends the content to a model (default: GPT) along with a safety evaluation
 * prompt and parses the structured JSON response.
 */
export class SafetyChecker {
  private readonly config: SafetyConfig;
  private readonly providers: Map<ModelId, ModelProvider>;

  constructor(
    providers: Map<ModelId, ModelProvider>,
    config?: Partial<SafetyConfig>,
  ) {
    this.providers = providers;
    this.config = {
      model: config?.model ?? MODEL_IDS.GPT,
      prompt: config?.prompt ?? DEFAULT_SAFETY_PROMPT,
    };
  }

  /**
   * Check whether the given content blocks are safe.
   *
   * @param content  The content blocks to evaluate
   * @param overrides  Per-request overrides for model / prompt
   */
  async check(
    content: ContentBlock[],
    overrides?: Partial<SafetyConfig>,
  ): Promise<SafetyResult> {
    const modelId = overrides?.model ?? this.config.model;
    const prompt = overrides?.prompt ?? this.config.prompt;

    const provider = this.providers.get(modelId);
    if (!provider) {
      throw new Error(
        `Safety check model "${modelId}" is not registered as a provider`,
      );
    }

    const plainText = contentToPlainText(content);

    const messages: Message[] = [
      {
        role: "system",
        content: [{ type: "text", text: prompt }],
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Evaluate the following content for safety:\n\n${plainText}`,
          },
        ],
      },
    ];

    const response = await provider.chat(messages);

    return this.parseResponse(response, modelId);
  }

  /**
   * Parse the safety model's response into a structured SafetyResult.
   * Attempts to extract JSON from the response text. If parsing fails,
   * defaults to flagging the content as unsafe (fail-closed).
   */
  private parseResponse(response: Message, checkedBy: ModelId): SafetyResult {
    const text = response.content
      .filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("");

    try {
      // Try to extract JSON from the response (it might be wrapped in markdown)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          safe: false,
          reason: "Safety model returned unparseable response — failing closed",
          checkedBy,
        };
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        safe: boolean;
        reason?: string;
      };

      return {
        safe: parsed.safe,
        reason: parsed.reason,
        checkedBy,
      };
    } catch {
      // If we can't parse the response, fail closed — treat as unsafe.
      return {
        safe: false,
        reason: "Safety model returned unparseable response — failing closed",
        checkedBy,
      };
    }
  }
}
