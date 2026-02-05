import { ChatMessage, ModelSpec, SafetyConfig, ContentPart } from "../types";
import { ModelProviderBase, ProviderResponse } from "./base";

/**
 * Anthropic Claude provider.
 *
 * Translates our generic format into Anthropic Messages API shape.
 * Requires ANTHROPIC_API_KEY environment variable.
 */
export class ClaudeProvider extends ModelProviderBase {
  readonly providerName = "claude";

  private get apiKey(): string {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY environment variable is required");
    return key;
  }

  async chat(
    messages: ChatMessage[],
    model: ModelSpec,
    config: SafetyConfig,
    temperature?: number
  ): Promise<ProviderResponse> {
    const systemMessages = messages.filter((m) => m.role === "system");
    const nonSystemMessages = messages.filter((m) => m.role !== "system");

    const systemText = [
      config.systemPromptPrefix,
      ...systemMessages.map((m) => extractText(m.content)),
    ]
      .filter(Boolean)
      .join("\n\n");

    const body = {
      model: model.modelId,
      max_tokens: config.maxOutputTokens,
      ...(temperature !== undefined && { temperature }),
      system: systemText,
      messages: nonSystemMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content.map(toAnthropicContent),
      })),
    };

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Claude API error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as Record<string, any>;

    const responseContent: ContentPart[] = data.content.map(
      (block: { type: string; text?: string }) => {
        if (block.type === "text") {
          return { type: "text" as const, text: block.text ?? "" };
        }
        return { type: "text" as const, text: "" };
      }
    );

    return {
      message: { role: "assistant", content: responseContent },
      usage: data.usage
        ? {
            inputTokens: data.usage.input_tokens,
            outputTokens: data.usage.output_tokens,
          }
        : undefined,
    };
  }
}

function toAnthropicContent(
  part: ContentPart
): Record<string, unknown> {
  switch (part.type) {
    case "text":
      return { type: "text", text: part.text };
    case "image":
      return {
        type: "image",
        source: {
          type: "base64",
          media_type: part.mimeType,
          data: part.data,
        },
      };
    case "file":
      // Claude accepts files as base64 documents
      return {
        type: "document",
        source: {
          type: "base64",
          media_type: part.mimeType,
          data: part.data,
        },
      };
  }
}

function extractText(parts: ContentPart[]): string {
  return parts
    .filter((p): p is Extract<ContentPart, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join(" ");
}
