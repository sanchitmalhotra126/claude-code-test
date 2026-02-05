import {
  ContentBlock,
  Message,
  ModelProvider,
  MODEL_IDS,
  ProviderError,
} from "../types";

/**
 * Adapter for the Anthropic Claude API.
 *
 * Translates the generic ContentBlock[] format into Anthropic's content-block
 * schema and back.
 */
export class ClaudeProvider implements ModelProvider {
  readonly id = MODEL_IDS.CLAUDE;

  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(opts?: { apiKey?: string; model?: string; baseUrl?: string }) {
    this.apiKey = opts?.apiKey ?? process.env.ANTHROPIC_API_KEY ?? "";
    this.model = opts?.model ?? "claude-sonnet-4-20250514";
    this.baseUrl =
      opts?.baseUrl ?? "https://api.anthropic.com";
  }

  async chat(messages: Message[]): Promise<Message> {
    const systemMsgs = messages.filter((m) => m.role === "system");
    const nonSystemMsgs = messages.filter((m) => m.role !== "system");

    const systemText = systemMsgs
      .flatMap((m) => m.content)
      .filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: 1024,
      messages: nonSystemMsgs.map((m) => ({
        role: m.role,
        content: m.content.map((block) => this.toAnthropicBlock(block)),
      })),
    };

    if (systemText) {
      body.system = systemText;
    }

    const res = await fetch(`${this.baseUrl}/v1/messages`, {
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
      throw new ProviderError(this.id, `API returned ${res.status}: ${text}`);
    }

    const data = (await res.json()) as {
      content: Array<{ type: string; text?: string }>;
    };

    const contentBlocks: ContentBlock[] = data.content
      .filter((b) => b.type === "text" && b.text)
      .map((b) => ({ type: "text" as const, text: b.text! }));

    return { role: "assistant", content: contentBlocks };
  }

  private toAnthropicBlock(
    block: ContentBlock,
  ): Record<string, unknown> {
    switch (block.type) {
      case "text":
        return { type: "text", text: block.text };
      case "image":
        return {
          type: "image",
          source: {
            type: "base64",
            media_type: block.mimeType,
            data: block.data,
          },
        };
      case "file":
        // Claude doesn't natively accept arbitrary files — send as text context.
        return {
          type: "text",
          text: `[Attached file: ${block.fileName} (${block.mimeType})]\n(base64 content omitted)`,
        };
    }
  }
}
