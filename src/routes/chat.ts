import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { ChatRequestSchema } from "../middleware/validate";
import { mergeSafetyConfig, checkInput, checkOutput, extractText, checkWithLLM } from "../safety";
import { getProvider } from "../providers";
import { ChatMessage, ChatResponse, ChatErrorResponse, ContentPart } from "../types";

export const chatRouter = Router();

/**
 * Extract all text from an array of content parts.
 */
function extractAllText(parts: ContentPart[]): string {
  return extractText(parts);
}

/**
 * POST /api/chat
 *
 * Main chat endpoint. The request flows through:
 *   1. Schema validation (zod)
 *   2. Safety config merge (caller overrides + platform defaults)
 *   3. Input safety check — keyword layer (structural + keyword scan)
 *   4. Input safety check — LLM layer (semantic evaluation via separate model)
 *   5. Model provider call
 *   6. Output safety check — keyword layer
 *   7. Output safety check — LLM layer
 *   8. Response
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
  // Cast zod-inferred messages to our ChatMessage type (structurally identical)
  const messages = body.messages as ChatMessage[];

  // 2. Merge safety config — enforce platform minimums
  const safetyConfig = mergeSafetyConfig(body.safetyConfig);

  // Track which safety layers ran
  const layersRun: ("keyword" | "llm")[] = ["keyword"];
  if (safetyConfig.llmSafety.enabled) {
    layersRun.push("llm");
  }

  // 3. Input safety — keyword layer (fast, runs first)
  const keywordInputCheck = checkInput(messages, safetyConfig);
  if (!keywordInputCheck.safe) {
    const errorResponse: ChatErrorResponse = {
      error: {
        code: "INPUT_SAFETY_VIOLATION",
        message:
          keywordInputCheck.reason ??
          "Your message was flagged by our safety filters. Please rephrase.",
      },
    };
    res.status(422).json(errorResponse);
    return;
  }

  // 4. Input safety — LLM layer (semantic, runs only if keyword layer passed)
  if (safetyConfig.llmSafety.enabled) {
    const userMessages = messages.filter((m) => m.role === "user");
    const userText = userMessages
      .map((m) => extractAllText(m.content))
      .join("\n");

    try {
      const llmInputCheck = await checkWithLLM(userText, safetyConfig);
      if (!llmInputCheck.safe) {
        const errorResponse: ChatErrorResponse = {
          error: {
            code: "INPUT_SAFETY_VIOLATION",
            message:
              llmInputCheck.reason ??
              "Your message was flagged by our safety filters. Please rephrase.",
          },
        };
        res.status(422).json(errorResponse);
        return;
      }
    } catch (err) {
      // If the LLM safety check fails (network error, etc.), block the request
      // rather than letting potentially unsafe content through.
      const errorResponse: ChatErrorResponse = {
        error: {
          code: "SAFETY_CHECK_ERROR",
          message: "Unable to complete safety evaluation. Please try again.",
        },
      };
      res.status(503).json(errorResponse);
      return;
    }
  }

  // 5. Call the model provider
  const provider = getProvider(body.model.provider);
  let providerResponse;

  try {
    providerResponse = await provider.chat(
      messages,
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

  // 6. Output safety — keyword layer
  const keywordOutputCheck = checkOutput(providerResponse.message, safetyConfig);
  if (!keywordOutputCheck.safe) {
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
        flaggedTopics: keywordOutputCheck.flaggedTopics,
        layersRun,
        flaggedBy: "keyword",
      },
    };
    res.status(200).json(response);
    return;
  }

  // 7. Output safety — LLM layer
  if (safetyConfig.llmSafety.enabled) {
    const outputText = extractAllText(providerResponse.message.content);

    try {
      const llmOutputCheck = await checkWithLLM(outputText, safetyConfig);
      if (!llmOutputCheck.safe) {
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
            flaggedTopics: llmOutputCheck.flaggedTopics,
            layersRun,
            flaggedBy: "llm",
          },
        };
        res.status(200).json(response);
        return;
      }
    } catch {
      // If output LLM safety check fails, replace with safe refusal
      const response: ChatResponse = {
        conversationId: body.conversationId ?? uuidv4(),
        model: body.model,
        message: {
          role: "assistant",
          content: [
            {
              type: "text",
              text: "I'm sorry, I encountered an issue verifying my response. Please try again.",
            },
          ],
        },
        safetyMeta: {
          inputCheckPassed: true,
          outputCheckPassed: false,
          flaggedTopics: [],
          layersRun,
          flaggedBy: "llm",
        },
      };
      res.status(200).json(response);
      return;
    }
  }

  // 8. Return clean response
  const response: ChatResponse = {
    conversationId: body.conversationId ?? uuidv4(),
    model: body.model,
    message: providerResponse.message,
    usage: providerResponse.usage,
    safetyMeta: {
      inputCheckPassed: true,
      outputCheckPassed: true,
      flaggedTopics: [],
      layersRun,
    },
  };

  res.status(200).json(response);
});
