import { Router, Request, Response } from "express";

export const modelsRouter = Router();

/** Available model catalogue. */
const MODELS = [
  {
    provider: "claude",
    modelId: "claude-sonnet-4-20250514",
    displayName: "Claude Sonnet 4",
    supportsImages: true,
    supportsFiles: true,
  },
  {
    provider: "claude",
    modelId: "claude-haiku-4-20250414",
    displayName: "Claude Haiku 4",
    supportsImages: true,
    supportsFiles: true,
  },
  {
    provider: "gpt",
    modelId: "gpt-4o",
    displayName: "GPT-4o",
    supportsImages: true,
    supportsFiles: false,
  },
  {
    provider: "gpt",
    modelId: "gpt-4o-mini",
    displayName: "GPT-4o Mini",
    supportsImages: true,
    supportsFiles: false,
  },
  {
    provider: "gemini",
    modelId: "gemini-2.0-flash",
    displayName: "Gemini 2.0 Flash",
    supportsImages: true,
    supportsFiles: true,
  },
  {
    provider: "gemini",
    modelId: "gemini-2.5-pro",
    displayName: "Gemini 2.5 Pro",
    supportsImages: true,
    supportsFiles: true,
  },
];

/**
 * GET /api/models
 *
 * Lists available models and their capabilities.
 */
modelsRouter.get("/", (_req: Request, res: Response) => {
  res.json({ models: MODELS });
});
