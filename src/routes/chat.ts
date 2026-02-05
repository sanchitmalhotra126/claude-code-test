import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { ChatRequestSchema } from "../middleware/validate";
import { mergeSafetyConfig, checkInput, checkOutput } from "../safety";
import { getProvider } from "../providers";
import { ChatResponse, ChatErrorResponse } from "../types";

export const chatRouter = Router();

/**
 * POST /api/chat
 *
 * Main chat endpoint. The request flows through:
 *   1. Schema validation (zod)
 *   2. Safety config merge (caller overrides + platform defaults)
 *   3. Input safety check (structural + keyword scan)
 *   4. Model provider call
 *   5. Output safety check
 *   6. Response
 */
chatRouter.post("/", async (req: Request, res: Response): Promise<void> => {
  // 1. Validate request shape
  const parsed = ChatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    const errorResponse: ChatErrorResponse = {
      error: {
        code: "INVALID_REQUEST",
        message: parsed.error.errors
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join("; "),
      },
    };
    res.status(400).json(errorResponse);
    return;
  }

  const body = parsed.data;

  // 2. Merge safety config — enforce platform minimums
  const safetyConfig = mergeSafetyConfig(body.safetyConfig);

  // 3. Check input safety
  const inputCheck = checkInput(body.messages, safetyConfig);
  if (!inputCheck.safe) {
    const errorResponse: ChatErrorResponse = {
      error: {
        code: "INPUT_SAFETY_VIOLATION",
        message:
          inputCheck.reason ??
          "Your message was flagged by our safety filters. Please rephrase.",
      },
    };
    res.status(422).json(errorResponse);
    return;
  }

  // 4. Call the model provider
  const provider = getProvider(body.model.provider);
  let providerResponse;

  try {
    providerResponse = await provider.chat(
      body.messages,
      body.model,
      safetyConfig,
      body.temperature
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown provider error";
    const errorResponse: ChatErrorResponse = {
      error: {
        code: "PROVIDER_ERROR",
        message,
      },
    };
    res.status(502).json(errorResponse);
    return;
  }

  // 5. Check output safety
  const outputCheck = checkOutput(providerResponse.message, safetyConfig);
  if (!outputCheck.safe) {
    // Don't return unsafe model output — replace with a safe refusal
    const response: ChatResponse = {
      conversationId: body.conversationId ?? uuidv4(),
      model: body.model,
      message: {
        role: "assistant",
        content: [
          {
            type: "text",
            text: "I'm sorry, but I can't provide that information. Let me know if there's something else I can help you with for your studies!",
          },
        ],
      },
      safetyMeta: {
        inputCheckPassed: true,
        outputCheckPassed: false,
        flaggedTopics: outputCheck.flaggedTopics,
      },
    };
    res.status(200).json(response);
    return;
  }

  // 6. Return clean response
  const response: ChatResponse = {
    conversationId: body.conversationId ?? uuidv4(),
    model: body.model,
    message: providerResponse.message,
    usage: providerResponse.usage,
    safetyMeta: {
      inputCheckPassed: true,
      outputCheckPassed: true,
      flaggedTopics: [],
    },
  };

  res.status(200).json(response);
});
