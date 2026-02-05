import { Chatbot } from "./chatbot";
import {
  ChatRequest,
  Message,
  ModelId,
  ModelProvider,
  MODEL_IDS,
  SafetyViolationError,
} from "./types";

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

/**
 * Creates a GPT provider that acts as safety checker.
 * First call: input safety check.  Second call: output safety check.
 */
function mockSafetyGpt(
  inputSafe: boolean,
  outputSafe: boolean,
  inputReason?: string,
  outputReason?: string,
): ModelProvider {
  const chat = jest.fn()
    .mockResolvedValueOnce({
      role: "assistant",
      content: [{
        type: "text",
        text: JSON.stringify({ safe: inputSafe, ...(inputReason ? { reason: inputReason } : {}) }),
      }],
    } satisfies Message)
    .mockResolvedValueOnce({
      role: "assistant",
      content: [{
        type: "text",
        text: JSON.stringify({ safe: outputSafe, ...(outputReason ? { reason: outputReason } : {}) }),
      }],
    } satisfies Message);

  return { id: MODEL_IDS.GPT, chat };
}

describe("Chatbot", () => {
  it("returns a response when both safety checks pass", async () => {
    const gpt = mockSafetyGpt(true, true);
    const claude = mockProvider(MODEL_IDS.CLAUDE, "Photosynthesis is the process...");
    const chatbot = new Chatbot([gpt, claude]);

    const request: ChatRequest = {
      model: MODEL_IDS.CLAUDE,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: "What is photosynthesis?" }],
        },
      ],
    };

    const result = await chatbot.chat(request);

    expect(result.message.content[0]).toEqual({
      type: "text",
      text: "Photosynthesis is the process...",
    });
    expect(result.safety.inputCheck.safe).toBe(true);
    expect(result.safety.outputCheck.safe).toBe(true);
    expect(result.model).toBe(MODEL_IDS.CLAUDE);
    expect(result.id).toBeDefined();
  });

  it("throws SafetyViolationError when input is unsafe", async () => {
    const gpt = mockSafetyGpt(false, true, "Inappropriate language");
    const claude = mockProvider(MODEL_IDS.CLAUDE, "response");
    const chatbot = new Chatbot([gpt, claude]);

    const request: ChatRequest = {
      model: MODEL_IDS.CLAUDE,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: "something bad" }],
        },
      ],
    };

    try {
      await chatbot.chat(request);
      fail("Expected SafetyViolationError");
    } catch (err) {
      expect(err).toBeInstanceOf(SafetyViolationError);
      const violation = err as SafetyViolationError;
      expect(violation.phase).toBe("input");
      expect(violation.result.reason).toBe("Inappropriate language");
    }

    // The target model should NOT have been called
    expect(claude.chat).not.toHaveBeenCalled();
  });

  it("throws SafetyViolationError when output is unsafe", async () => {
    const gpt = mockSafetyGpt(true, false, undefined, "Model produced unsafe content");
    const claude = mockProvider(MODEL_IDS.CLAUDE, "bad response");
    const chatbot = new Chatbot([gpt, claude]);

    const request: ChatRequest = {
      model: MODEL_IDS.CLAUDE,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: "Tell me a story" }],
        },
      ],
    };

    try {
      await chatbot.chat(request);
      fail("Expected SafetyViolationError");
    } catch (err) {
      expect(err).toBeInstanceOf(SafetyViolationError);
      const violation = err as SafetyViolationError;
      expect(violation.phase).toBe("output");
    }
  });

  it("skips safety checks when skipSafety is true", async () => {
    const gpt = mockProvider(MODEL_IDS.GPT, "response text");
    const chatbot = new Chatbot([gpt]);

    const request: ChatRequest = {
      model: MODEL_IDS.GPT,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: "hello" }],
        },
      ],
      skipSafety: true,
    };

    const result = await chatbot.chat(request);

    expect(result.safety.inputCheck.safe).toBe(true);
    expect(result.safety.outputCheck.safe).toBe(true);
    // Only one call — the actual chat, no safety check calls
    expect(gpt.chat).toHaveBeenCalledTimes(1);
  });

  it("throws on unknown model", async () => {
    const gpt = mockProvider(MODEL_IDS.GPT, "ok");
    const chatbot = new Chatbot([gpt]);

    const request: ChatRequest = {
      model: MODEL_IDS.CLAUDE,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: "hello" }],
        },
      ],
    };

    await expect(chatbot.chat(request)).rejects.toThrow("Unknown model");
  });

  it("uses a custom safety model when specified", async () => {
    const gpt = mockProvider(MODEL_IDS.GPT, "gpt response");
    const claude: ModelProvider = {
      id: MODEL_IDS.CLAUDE,
      chat: jest.fn()
        // First call: safety check on input
        .mockResolvedValueOnce({
          role: "assistant",
          content: [{ type: "text", text: '{"safe": true}' }],
        } satisfies Message)
        // Second call: safety check on output
        .mockResolvedValueOnce({
          role: "assistant",
          content: [{ type: "text", text: '{"safe": true}' }],
        } satisfies Message),
    };

    const chatbot = new Chatbot([gpt, claude]);

    const request: ChatRequest = {
      model: MODEL_IDS.GPT,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: "hello" }],
        },
      ],
      safetyModel: MODEL_IDS.CLAUDE,
    };

    const result = await chatbot.chat(request);

    expect(result.safety.inputCheck.checkedBy).toBe(MODEL_IDS.CLAUDE);
    expect(result.safety.outputCheck.checkedBy).toBe(MODEL_IDS.CLAUDE);
    // Claude should have been called for safety, GPT for the actual chat
    expect(claude.chat).toHaveBeenCalledTimes(2);
    expect(gpt.chat).toHaveBeenCalledTimes(1);
  });
});
