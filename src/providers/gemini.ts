import { ChatMessage, ModelSpec, SafetyConfig, ContentPart } from "../types";
import { ModelProviderBase, ProviderResponse } from "./base";

/**
 * Google Gemini provider.
 *
 * Translates our generic format into the Gemini generateContent API shape.
 * Requires GEMINI_API_KEY environment variable.
 */
export class GeminiProvider extends ModelProviderBase {
  readonly providerName = "gemini";

  private get apiKey(): string {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY environment variable is required");
    return key;
  }

  async chat(
    messages: ChatMessage[],
    model: ModelSpec,
    config: SafetyConfig,
    temperature?: number
  ): Promise<ProviderResponse> {
    const systemInstruction = config.systemPromptPrefix;

    // Gemini uses "user" and "model" roles, and content is an array of "parts"
    const contents: Record<string, unknown>[] = [];
    for (const msg of messages) {
      if (msg.role === "system") continue; // handled via systemInstruction
      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: msg.content.map(toGeminiPart),
      });
    }

    const body = {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents,
      generationConfig: {
        maxOutputTokens: config.maxOutputTokens,
        ...(temperature !== undefined && { temperature }),
      },
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model.modelId}:generateContent?key=${this.apiKey}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as Record<string, any>;
    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];

    const responseContent: ContentPart[] = parts.map(
      (p: { text?: string }) => ({
        type: "text" as const,
        text: p.text ?? "",
      })
    );

    return {
      message: { role: "assistant", content: responseContent },
      usage: data.usageMetadata
        ? {
            inputTokens: data.usageMetadata.promptTokenCount ?? 0,
            outputTokens: data.usageMetadata.candidatesTokenCount ?? 0,
          }
        : undefined,
    };
  }
}

function toGeminiPart(part: ContentPart): Record<string, unknown> {
  switch (part.type) {
    case "text":
      return { text: part.text };
    case "image":
      return {
        inlineData: {
          mimeType: part.mimeType,
          data: part.data,
        },
      };
    case "file":
      return {
        inlineData: {
          mimeType: part.mimeType,
          data: part.data,
        },
      };
  }
}
