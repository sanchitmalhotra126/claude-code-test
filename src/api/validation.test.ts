import { chatRequestSchema } from "./validation";

describe("chatRequestSchema", () => {
  it("accepts a valid text-only request", () => {
    const result = chatRequestSchema.safeParse({
      model: "claude",
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: "Hello" }],
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("accepts a request with image content", () => {
    const result = chatRequestSchema.safeParse({
      model: "gpt",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "What is this image?" },
            { type: "image", data: "abc123", mimeType: "image/png" },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("accepts a request with file content", () => {
    const result = chatRequestSchema.safeParse({
      model: "gemini",
      messages: [
        {
          role: "user",
          content: [
            { type: "file", data: "abc123", mimeType: "application/pdf", fileName: "essay.pdf" },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("accepts optional safety overrides", () => {
    const result = chatRequestSchema.safeParse({
      model: "claude",
      messages: [
        { role: "user", content: [{ type: "text", text: "hi" }] },
      ],
      safetyModel: "claude",
      safetyPrompt: "My custom prompt",
      skipSafety: true,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an unknown model", () => {
    const result = chatRequestSchema.safeParse({
      model: "unknown-model",
      messages: [
        { role: "user", content: [{ type: "text", text: "hi" }] },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects empty messages array", () => {
    const result = chatRequestSchema.safeParse({
      model: "claude",
      messages: [],
    });

    expect(result.success).toBe(false);
  });

  it("rejects message with empty content", () => {
    const result = chatRequestSchema.safeParse({
      model: "claude",
      messages: [
        { role: "user", content: [] },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid image mime type", () => {
    const result = chatRequestSchema.safeParse({
      model: "claude",
      messages: [
        {
          role: "user",
          content: [
            { type: "image", data: "abc", mimeType: "image/bmp" },
          ],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const noModel = chatRequestSchema.safeParse({
      messages: [
        { role: "user", content: [{ type: "text", text: "hi" }] },
      ],
    });
    expect(noModel.success).toBe(false);

    const noMessages = chatRequestSchema.safeParse({
      model: "claude",
    });
    expect(noMessages.success).toBe(false);
  });
});
