import { z } from "zod";

/** Zod schema for runtime validation of incoming chat requests. */

const ContentPartSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    text: z.string().min(1),
  }),
  z.object({
    type: z.literal("image"),
    data: z.string().min(1),
    mimeType: z.enum(["image/png", "image/jpeg", "image/gif", "image/webp"]),
  }),
  z.object({
    type: z.literal("file"),
    data: z.string().min(1),
    mimeType: z.string().min(1),
    fileName: z.string().min(1),
  }),
]);

const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.array(ContentPartSchema).min(1),
});

const ModelSpecSchema = z.object({
  provider: z.enum(["claude", "gpt", "gemini"]),
  modelId: z.enum([
    "claude-sonnet-4-20250514",
    "claude-haiku-4-20250414",
    "gpt-4o",
    "gpt-4o-mini",
    "gemini-2.0-flash",
    "gemini-2.5-pro",
  ]),
});

const LLMSafetyModelSpecSchema = z.object({
  provider: z.enum(["gpt", "claude", "gemini"]),
  modelId: z.string().min(1),
});

const LLMSafetyConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    model: LLMSafetyModelSpecSchema.optional(),
    customPrompt: z.string().min(10).optional(),
  })
  .optional();

const SafetyConfigOverrideSchema = z
  .object({
    level: z.enum(["strict", "moderate"]).optional(),
    blockedTopics: z
      .array(
        z.enum([
          "violence",
          "sexual_content",
          "self_harm",
          "hate_speech",
          "drugs_alcohol",
          "profanity",
          "personal_information",
          "dangerous_activities",
          "academic_dishonesty",
        ])
      )
      .optional(),
    maxInputLength: z.number().int().positive().optional(),
    maxOutputTokens: z.number().int().positive().optional(),
    allowImageInput: z.boolean().optional(),
    allowFileUpload: z.boolean().optional(),
    allowedFileMimeTypes: z.array(z.string()).optional(),
    maxFileSizeBytes: z.number().int().positive().optional(),
    systemPromptPrefix: z.string().optional(),
    llmSafety: LLMSafetyConfigSchema,
  })
  .optional();

export const ChatRequestSchema = z.object({
  conversationId: z.string().optional(),
  model: ModelSpecSchema,
  messages: z.array(ChatMessageSchema).min(1),
  safetyConfig: SafetyConfigOverrideSchema,
  temperature: z.number().min(0).max(1).optional(),
});

export type ValidatedChatRequest = z.infer<typeof ChatRequestSchema>;
