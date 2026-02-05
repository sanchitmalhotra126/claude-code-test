import { Router, Request, Response } from "express";
import { Chatbot } from "../chatbot";
import { SafetyViolationError, ProviderError } from "../types";
import { chatRequestSchema } from "./validation";

/**
 * Creates the Express router for the chatbot API.
 */
export function createRouter(chatbot: Chatbot): Router {
  const router = Router();

  /**
   * POST /chat
   *
   * Accepts a ChatRequest body, runs safety checks, forwards to the target
   * model, and returns the response.
   */
  router.post("/chat", async (req: Request, res: Response) => {
    const parsed = chatRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request",
        details: parsed.error.issues,
      });
      return;
    }

    try {
      const result = await chatbot.chat(parsed.data);
      res.json(result);
    } catch (err) {
      if (err instanceof SafetyViolationError) {
        res.status(422).json({
          error: "Content safety violation",
          phase: err.phase,
          reason: err.result.reason,
          checkedBy: err.result.checkedBy,
        });
        return;
      }

      if (err instanceof ProviderError) {
        res.status(502).json({
          error: "Model provider error",
          provider: err.provider,
          message: err.message,
        });
        return;
      }

      console.error("Unexpected error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * GET /health
   */
  router.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  return router;
}
