import { ChatMessage, ModelSpec, SafetyConfig, ContentPart } from "../types";
import { ModelProviderBase, ProviderResponse } from "./base";

/**
 * OpenAI GPT provider.
 *
 * Translates our generic format into the OpenAI Chat Completions API shape.
 * Requires OPENAI_API_KEY environment variable.
 */
export class GptProvider extends ModelProviderBase {
  readonly providerName = "gpt";

  private get apiKey(): string {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY environment variable is required");
    return key;
  }

  async chat(
    messages: ChatMessage[],
    model: ModelSpec,
    config: SafetyConfig,
    temperature?: number
  ): Promise<ProviderResponse> {
    // Prepend the safety system prompt
    const openAIMessages: Record<string, unknown>[] = [
      { role: "system", content: config.systemPromptPrefix },
    ];

    for (const msg of messages) {
      if (msg.role === "system") {
        openAIMessages.push({
          role: "system",
          content: extractText(msg.content),
        });
      } else {
        const parts = msg.content.map(toOpenAIContent);
        // If all parts are simple text, flatten to a string
        const allText = parts.every((p) => typeof p === "string");
        openAIMessages.push({
          role: msg.role,
          content: allText ? parts.join(" ") : parts,
        });
      }
    }

    const body = {
      model: model.modelId,
      max_tokens: config.maxOutputTokens,
      ...(temperature !== undefined && { temperature }),
      messages: openAIMessages,
    };

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI API error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as Record<string, any>;
    const choice = data.choices?.[0];
    const responseText: string = choice?.message?.content ?? "";

    return {
      message: {
        role: "assistant",
        content: [{ type: "text", text: responseText }],
      },
      usage: data.usage
        ? {
            inputTokens: data.usage.prompt_tokens,
            outputTokens: data.usage.completion_tokens,
          }
        : undefined,
    };
  }
}

function toOpenAIContent(part: ContentPart): unknown {
  switch (part.type) {
    case "text":
      return { type: "text", text: part.text };
    case "image":
      return {
        type: "image_url",
        image_url: { url: `data:${part.mimeType};base64,${part.data}` },
      };
    case "file":
      // OpenAI doesn't natively accept arbitrary files in chat completions.
      // We pass the content as text with a file header for text-based files.
      return {
        type: "text",
        text: `[File: ${part.fileName} (${part.mimeType})]\n${Buffer.from(part.data, "base64").toString("utf-8")}`,
      };
  }
}

function extractText(parts: ContentPart[]): string {
  return parts
    .filter((p): p is Extract<ContentPart, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join(" ");
}
