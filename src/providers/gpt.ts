import {
  ContentBlock,
  Message,
  ModelProvider,
  MODEL_IDS,
  ProviderError,
} from "../types";

/**
 * Adapter for the OpenAI GPT API.
 */
export class GptProvider implements ModelProvider {
  readonly id = MODEL_IDS.GPT;

  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(opts?: { apiKey?: string; model?: string; baseUrl?: string }) {
    this.apiKey = opts?.apiKey ?? process.env.OPENAI_API_KEY ?? "";
    this.model = opts?.model ?? "gpt-4o";
    this.baseUrl =
      opts?.baseUrl ?? "https://api.openai.com";
  }

  async chat(messages: Message[]): Promise<Message> {
    const body = {
      model: this.model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content.map((block) => this.toOpenAiBlock(block)),
      })),
    };

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new ProviderError(this.id, `API returned ${res.status}: ${text}`);
    }

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const text = data.choices[0]?.message?.content ?? "";

    return {
      role: "assistant",
      content: [{ type: "text", text }],
    };
  }

  private toOpenAiBlock(
    block: ContentBlock,
  ): Record<string, unknown> {
    switch (block.type) {
      case "text":
        return { type: "text", text: block.text };
      case "image":
        return {
          type: "image_url",
          image_url: {
            url: `data:${block.mimeType};base64,${block.data}`,
          },
        };
      case "file":
        return {
          type: "text",
          text: `[Attached file: ${block.fileName} (${block.mimeType})]`,
        };
    }
  }
}
