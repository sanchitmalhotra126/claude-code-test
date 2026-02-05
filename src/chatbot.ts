import { v4 as uuid } from "uuid";
import { SafetyChecker } from "./safety";
import {
  ChatRequest,
  ChatResponse,
  ModelId,
  ModelProvider,
  MODEL_IDS,
  SafetyResult,
  SafetyViolationError,
} from "./types";

const SAFE_PASS: SafetyResult = {
  safe: true,
  checkedBy: MODEL_IDS.GPT,
};

/**
 * Core chatbot orchestrator.
 *
 * Ties together model providers and the safety layer:
 *   1. Run safety check on the student's input
 *   2. Forward the conversation to the target model
 *   3. Run safety check on the model's output
 *   4. Return the response (or throw if either check fails)
 */
export class Chatbot {
  private readonly providers: Map<ModelId, ModelProvider>;
  private readonly safetyChecker: SafetyChecker;

  constructor(providers: ModelProvider[]) {
    this.providers = new Map(providers.map((p) => [p.id, p]));
    this.safetyChecker = new SafetyChecker(this.providers);
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const provider = this.providers.get(request.model);
    if (!provider) {
      throw new Error(`Unknown model: ${request.model}`);
    }

    // ---- 1. Input safety check ----
    let inputCheck: SafetyResult;

    if (request.skipSafety) {
      inputCheck = { ...SAFE_PASS };
    } else {
      const lastUserMsg = [...request.messages]
        .reverse()
        .find((m) => m.role === "user");

      if (lastUserMsg) {
        inputCheck = await this.safetyChecker.check(lastUserMsg.content, {
          model: request.safetyModel,
          prompt: request.safetyPrompt,
        });
      } else {
        inputCheck = { ...SAFE_PASS };
      }

      if (!inputCheck.safe) {
        throw new SafetyViolationError(inputCheck, "input");
      }
    }

    // ---- 2. Forward to target model ----
    const assistantMessage = await provider.chat(request.messages);

    // ---- 3. Output safety check ----
    let outputCheck: SafetyResult;

    if (request.skipSafety) {
      outputCheck = { ...SAFE_PASS };
    } else {
      outputCheck = await this.safetyChecker.check(assistantMessage.content, {
        model: request.safetyModel,
        prompt: request.safetyPrompt,
      });

      if (!outputCheck.safe) {
        throw new SafetyViolationError(outputCheck, "output");
      }
    }

    // ---- 4. Return ----
    return {
      id: uuid(),
      model: request.model,
      message: assistantMessage,
      safety: { inputCheck, outputCheck },
    };
  }
}
