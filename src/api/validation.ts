import { z } from "zod";
import { MODEL_IDS } from "../types";

const modelIdSchema = z.enum([MODEL_IDS.CLAUDE, MODEL_IDS.GPT, MODEL_IDS.GEMINI]);

const textContentSchema = z.object({
  type: z.literal("text"),
  text: z.string().min(1),
});

const imageContentSchema = z.object({
  type: z.literal("image"),
  data: z.string().min(1),
  mimeType: z.enum(["image/png", "image/jpeg", "image/gif", "image/webp"]),
});

const fileContentSchema = z.object({
  type: z.literal("file"),
  data: z.string().min(1),
  mimeType: z.string().min(1),
  fileName: z.string().min(1),
});

const contentBlockSchema = z.discriminatedUnion("type", [
  textContentSchema,
  imageContentSchema,
  fileContentSchema,
]);

const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.array(contentBlockSchema).min(1),
});

export const chatRequestSchema = z.object({
  model: modelIdSchema,
  messages: z.array(messageSchema).min(1),
  safetyModel: modelIdSchema.optional(),
  safetyPrompt: z.string().optional(),
  skipSafety: z.boolean().optional(),
});
