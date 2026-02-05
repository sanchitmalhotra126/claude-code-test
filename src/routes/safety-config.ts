import { Router, Request, Response } from "express";
import { DEFAULT_SAFETY_CONFIG } from "../types";

export const safetyConfigRouter = Router();

/**
 * GET /api/safety-config
 *
 * Returns the current platform-default safety configuration.
 * Useful for clients to understand what defaults are in effect and what
 * overrides are available.
 */
safetyConfigRouter.get("/", (_req: Request, res: Response) => {
  res.json({
    defaults: DEFAULT_SAFETY_CONFIG,
    notes: {
      overridePolicy:
        "Callers may tighten constraints (e.g. lower maxInputLength, add blockedTopics) " +
        "but cannot weaken them beyond the platform defaults.",
      blockedTopicsMerge:
        "Custom blockedTopics are unioned with defaults — you can add topics but not remove them.",
      systemPromptPrefixMerge:
        "Custom systemPromptPrefix is appended to the default, not replacing it.",
    },
  });
});
