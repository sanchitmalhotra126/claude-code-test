import {
  ContentBlock,
  Message,
  ModelProvider,
  MODEL_IDS,
  ProviderError,
} from "../types";

/**
 * Adapter for the Google Gemini API.
 */
export class GeminiProvider implements ModelProvider {
  readonly id = MODEL_IDS.GEMINI;

  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(opts?: { apiKey?: string; model?: string; baseUrl?: string }) {
    this.apiKey = opts?.apiKey ?? process.env.GEMINI_API_KEY ?? "";
    this.model = opts?.model ?? "gemini-1.5-pro";
    this.baseUrl =
      opts?.baseUrl ?? "https://generativelanguage.googleapis.com";
  }

  async chat(messages: Message[]): Promise<Message> {
    const systemMsgs = messages.filter((m) => m.role === "system");
    const nonSystemMsgs = messages.filter((m) => m.role !== "system");

    const systemText = systemMsgs
      .flatMap((m) => m.content)
      .filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    const contents = nonSystemMsgs.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: m.content.map((block) => this.toGeminiPart(block)),
    }));

    const body: Record<string, unknown> = { contents };

    if (systemText) {
      body.systemInstruction = { parts: [{ text: systemText }] };
    }

    const url =
      `${this.baseUrl}/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new ProviderError(this.id, `API returned ${res.status}: ${text}`);
    }

    const data = (await res.json()) as {
      candidates: Array<{
        content: { parts: Array<{ text?: string }> };
      }>;
    };

    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const text = parts
      .filter((p) => p.text)
      .map((p) => p.text!)
      .join("");

    return {
      role: "assistant",
      content: [{ type: "text", text }],
    };
  }

  private toGeminiPart(
    block: ContentBlock,
  ): Record<string, unknown> {
    switch (block.type) {
      case "text":
        return { text: block.text };
      case "image":
        return {
          inlineData: {
            mimeType: block.mimeType,
            data: block.data,
          },
        };
      case "file":
        return {
          text: `[Attached file: ${block.fileName} (${block.mimeType})]`,
        };
    }
  }
}
