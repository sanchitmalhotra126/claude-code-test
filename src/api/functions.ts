import { Chatbot } from "../chatbot";
import { ChatRequest, ChatResponse, ValidationError } from "../types";
import { chatRequestSchema } from "./validation";

export interface HealthCheckResponse {
  status: "ok";
}

export interface Api {
  chat(request: ChatRequest): Promise<ChatResponse>;
  healthCheck(): HealthCheckResponse;
}

/**
 * Creates a set of callable API functions backed by the given Chatbot instance.
 *
 * - `chat` validates the request with Zod, then delegates to the chatbot.
 *   Throws `ValidationError` for malformed input, `SafetyViolationError`
 *   for content violations, or `ProviderError` for model failures.
 * - `healthCheck` returns a simple status object.
 */
export function createApi(chatbot: Chatbot): Api {
  return {
    async chat(request: ChatRequest): Promise<ChatResponse> {
      const parsed = chatRequestSchema.safeParse(request);

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues.map((i) => ({
            message: i.message,
            path: i.path,
          })),
        );
      }

      return chatbot.chat(parsed.data);
    },

    healthCheck(): HealthCheckResponse {
      return { status: "ok" };
    },
  };
}
