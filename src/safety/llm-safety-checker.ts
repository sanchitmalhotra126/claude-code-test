import {
  SafetyConfig,
  SafetyCheckResult,
  BlockedTopic,
  LLMSafetyConfig,
  LLMSafetyModelSpec,
  DEFAULT_LLM_SAFETY_PROMPT,
} from "../types";

/**
 * LLM-based safety evaluation layer.
 *
 * Sends content to a separate LLM and asks it to judge whether the content
 * is safe and age-appropriate for middle school students. This complements
 * the fast keyword-based filter with deeper semantic understanding — catching
 * obfuscated, implicit, or context-dependent unsafe content that regex
 * patterns would miss.
 *
 * Flow:
 *   1. Build the evaluation prompt (default or custom)
 *   2. Call the configured safety model (defaults to GPT-4o Mini)
 *   3. Parse the JSON verdict
 *   4. Return a SafetyCheckResult
 */

/** Shape we expect the safety model to return. */
interface LLMSafetyVerdict {
  safe: boolean;
  flaggedTopics: string[];
  reason: string | null;
}

/**
 * Build the safety evaluation prompt by injecting content and topic list
 * into the template.
 */
function buildPrompt(
  template: string,
  content: string,
  blockedTopics: BlockedTopic[]
): string {
  const topicList = blockedTopics
    .map((t) => `- ${t.replace(/_/g, " ")}`)
    .join("\n");

  return template
    .replace("{{CONTENT}}", content)
    .replace("{{BLOCKED_TOPICS}}", topicList);
}

/**
 * Call the GPT API for safety evaluation.
 */
async function callGpt(
  prompt: string,
  modelId: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for GPT safety checks");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 256,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You are a content safety classifier. Respond with only valid JSON.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GPT safety check API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as Record<string, any>;
  return data.choices?.[0]?.message?.content ?? "";
}

/**
 * Call the Claude API for safety evaluation.
 */
async function callClaude(
  prompt: string,
  modelId: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required for Claude safety checks");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 256,
      temperature: 0,
      system:
        "You are a content safety classifier. Respond with only valid JSON.",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Claude safety check API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as Record<string, any>;
  const block = data.content?.[0];
  return block?.text ?? "";
}

/**
 * Call the Gemini API for safety evaluation.
 */
async function callGemini(
  prompt: string,
  modelId: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is required for Gemini safety checks");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: "You are a content safety classifier. Respond with only valid JSON.",
          },
        ],
      },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 256, temperature: 0 },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini safety check API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as Record<string, any>;
  const part = data.candidates?.[0]?.content?.parts?.[0];
  return part?.text ?? "";
}

/**
 * Dispatch to the appropriate provider for the safety evaluation call.
 */
async function callSafetyModel(
  prompt: string,
  model: LLMSafetyModelSpec
): Promise<string> {
  switch (model.provider) {
    case "gpt":
      return callGpt(prompt, model.modelId);
    case "claude":
      return callClaude(prompt, model.modelId);
    case "gemini":
      return callGemini(prompt, model.modelId);
    default:
      throw new Error(`Unsupported safety model provider: ${model.provider}`);
  }
}

/**
 * Parse the LLM's JSON response into a structured verdict.
 * Handles cases where the model wraps JSON in markdown code fences.
 */
function parseVerdict(raw: string): LLMSafetyVerdict {
  // Strip markdown code fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "");
  }

  try {
    const parsed = JSON.parse(cleaned);
    return {
      safe: typeof parsed.safe === "boolean" ? parsed.safe : true,
      flaggedTopics: Array.isArray(parsed.flaggedTopics)
        ? parsed.flaggedTopics
        : [],
      reason: typeof parsed.reason === "string" ? parsed.reason : null,
    };
  } catch {
    // If parsing fails, treat as safe to avoid false-positive blocks,
    // but log the failure for monitoring.
    console.error("Failed to parse LLM safety verdict:", raw);
    return { safe: true, flaggedTopics: [], reason: null };
  }
}

/**
 * Run the LLM-based safety check on a piece of content.
 *
 * @param content     The text content to evaluate.
 * @param safetyConfig  The full merged safety config (for blocked topics list).
 * @returns A SafetyCheckResult with source set to "llm".
 */
export async function checkWithLLM(
  content: string,
  safetyConfig: SafetyConfig
): Promise<SafetyCheckResult> {
  const llmConfig = safetyConfig.llmSafety;

  if (!llmConfig.enabled) {
    return { safe: true, flaggedTopics: [], source: "llm" };
  }

  // Skip empty content
  if (!content.trim()) {
    return { safe: true, flaggedTopics: [], source: "llm" };
  }

  const promptTemplate = llmConfig.customPrompt ?? DEFAULT_LLM_SAFETY_PROMPT;
  const prompt = buildPrompt(
    promptTemplate,
    content,
    safetyConfig.blockedTopics
  );

  const rawResponse = await callSafetyModel(prompt, llmConfig.model);
  const verdict = parseVerdict(rawResponse);

  if (!verdict.safe) {
    return {
      safe: false,
      flaggedTopics: verdict.flaggedTopics as BlockedTopic[],
      reason: verdict.reason ?? "Content flagged by LLM safety evaluation",
      source: "llm",
    };
  }

  return { safe: true, flaggedTopics: [], source: "llm" };
}
