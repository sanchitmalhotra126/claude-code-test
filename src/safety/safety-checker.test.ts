import { SafetyChecker } from "./safety-checker";
import {
  ContentBlock,
  Message,
  ModelId,
  ModelProvider,
  MODEL_IDS,
} from "../types";

/** Creates a mock provider that returns a canned response */
function mockProvider(
  id: ModelId,
  responseText: string,
): ModelProvider {
  return {
    id,
    chat: jest.fn().mockResolvedValue({
      role: "assistant",
      content: [{ type: "text", text: responseText }],
    } satisfies Message),
  };
}

function providers(...list: ModelProvider[]): Map<ModelId, ModelProvider> {
  return new Map(list.map((p) => [p.id, p]));
}

describe("SafetyChecker", () => {
  it("returns safe: true for safe content", async () => {
    const gpt = mockProvider(MODEL_IDS.GPT, '{"safe": true}');
    const checker = new SafetyChecker(providers(gpt));

    const content: ContentBlock[] = [
      { type: "text", text: "What is photosynthesis?" },
    ];

    const result = await checker.check(content);

    expect(result.safe).toBe(true);
    expect(result.checkedBy).toBe(MODEL_IDS.GPT);
  });

  it("returns safe: false with reason for unsafe content", async () => {
    const gpt = mockProvider(
      MODEL_IDS.GPT,
      '{"safe": false, "reason": "Contains violent content"}',
    );
    const checker = new SafetyChecker(providers(gpt));

    const content: ContentBlock[] = [
      { type: "text", text: "something unsafe" },
    ];

    const result = await checker.check(content);

    expect(result.safe).toBe(false);
    expect(result.reason).toBe("Contains violent content");
  });

  it("fails closed when the safety model returns unparseable text", async () => {
    const gpt = mockProvider(MODEL_IDS.GPT, "I don't know how to respond");
    const checker = new SafetyChecker(providers(gpt));

    const content: ContentBlock[] = [{ type: "text", text: "hello" }];
    const result = await checker.check(content);

    expect(result.safe).toBe(false);
    expect(result.reason).toContain("unparseable");
  });

  it("extracts JSON from markdown-wrapped responses", async () => {
    const gpt = mockProvider(
      MODEL_IDS.GPT,
      '```json\n{"safe": true}\n```',
    );
    const checker = new SafetyChecker(providers(gpt));

    const content: ContentBlock[] = [{ type: "text", text: "hello" }];
    const result = await checker.check(content);

    expect(result.safe).toBe(true);
  });

  it("allows overriding the safety model per check", async () => {
    const gpt = mockProvider(MODEL_IDS.GPT, '{"safe": true}');
    const claude = mockProvider(MODEL_IDS.CLAUDE, '{"safe": true}');
    const checker = new SafetyChecker(providers(gpt, claude));

    const content: ContentBlock[] = [{ type: "text", text: "hello" }];
    const result = await checker.check(content, {
      model: MODEL_IDS.CLAUDE,
    });

    expect(result.checkedBy).toBe(MODEL_IDS.CLAUDE);
    expect(claude.chat).toHaveBeenCalled();
    expect(gpt.chat).not.toHaveBeenCalled();
  });

  it("allows overriding the safety prompt per check", async () => {
    const gpt = mockProvider(MODEL_IDS.GPT, '{"safe": true}');
    const checker = new SafetyChecker(providers(gpt));

    const customPrompt = "My custom safety prompt";
    const content: ContentBlock[] = [{ type: "text", text: "hello" }];
    await checker.check(content, { prompt: customPrompt });

    const callArgs = (gpt.chat as jest.Mock).mock.calls[0][0] as Message[];
    const systemMsg = callArgs.find((m) => m.role === "system");
    expect(systemMsg).toBeDefined();
    const systemText = systemMsg!.content
      .filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("");
    expect(systemText).toBe(customPrompt);
  });

  it("throws when the requested safety model is not registered", async () => {
    const gpt = mockProvider(MODEL_IDS.GPT, '{"safe": true}');
    const checker = new SafetyChecker(providers(gpt));

    const content: ContentBlock[] = [{ type: "text", text: "hello" }];

    await expect(
      checker.check(content, { model: MODEL_IDS.GEMINI }),
    ).rejects.toThrow('not registered');
  });

  it("handles image and file content blocks in the text representation", async () => {
    const gpt = mockProvider(MODEL_IDS.GPT, '{"safe": true}');
    const checker = new SafetyChecker(providers(gpt));

    const content: ContentBlock[] = [
      { type: "text", text: "Here is my homework" },
      { type: "image", data: "abc123", mimeType: "image/png" },
      { type: "file", data: "def456", mimeType: "application/pdf", fileName: "essay.pdf" },
    ];

    await checker.check(content);

    const callArgs = (gpt.chat as jest.Mock).mock.calls[0][0] as Message[];
    const userMsg = callArgs.find((m) => m.role === "user");
    const userText = userMsg!.content
      .filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("");

    expect(userText).toContain("Here is my homework");
    expect(userText).toContain("[Image: image/png]");
    expect(userText).toContain("[File: essay.pdf (application/pdf)]");
  });
});
