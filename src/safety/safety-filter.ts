import {
  SafetyConfig,
  SafetyCheckResult,
  BlockedTopic,
  ContentPart,
  ChatMessage,
  DEFAULT_SAFETY_CONFIG,
} from "../types";
import { TOPIC_PATTERNS } from "./keyword-lists";

/**
 * Merges a caller-provided partial safety config with the platform defaults.
 *
 * Critical rule: callers can tighten constraints but NOT loosen them beyond
 * the platform minimum. For example they can lower maxInputLength but not
 * raise it above the default.
 */
export function mergeSafetyConfig(
  overrides?: Partial<SafetyConfig>
): SafetyConfig {
  if (!overrides) return { ...DEFAULT_SAFETY_CONFIG };

  const defaults = DEFAULT_SAFETY_CONFIG;

  return {
    level: overrides.level === "moderate" && defaults.level === "strict"
      ? "strict" // cannot weaken
      : overrides.level ?? defaults.level,

    blockedTopics: overrides.blockedTopics
      ? unionTopics(defaults.blockedTopics, overrides.blockedTopics)
      : [...defaults.blockedTopics],

    maxInputLength: overrides.maxInputLength
      ? Math.min(overrides.maxInputLength, defaults.maxInputLength)
      : defaults.maxInputLength,

    maxOutputTokens: overrides.maxOutputTokens
      ? Math.min(overrides.maxOutputTokens, defaults.maxOutputTokens)
      : defaults.maxOutputTokens,

    allowImageInput:
      overrides.allowImageInput === false ? false : defaults.allowImageInput,

    allowFileUpload:
      overrides.allowFileUpload === false ? false : defaults.allowFileUpload,

    allowedFileMimeTypes: overrides.allowedFileMimeTypes
      ? intersectArrays(defaults.allowedFileMimeTypes, overrides.allowedFileMimeTypes)
      : [...defaults.allowedFileMimeTypes],

    maxFileSizeBytes: overrides.maxFileSizeBytes
      ? Math.min(overrides.maxFileSizeBytes, defaults.maxFileSizeBytes)
      : defaults.maxFileSizeBytes,

    systemPromptPrefix:
      overrides.systemPromptPrefix
        ? `${defaults.systemPromptPrefix} ${overrides.systemPromptPrefix}`
        : defaults.systemPromptPrefix,
  };
}

/** Union two topic arrays (can only add, never remove defaults). */
function unionTopics(base: BlockedTopic[], extra: BlockedTopic[]): BlockedTopic[] {
  return [...new Set([...base, ...extra])];
}

/** Intersection — restrict file types to only those the platform allows. */
function intersectArrays(base: string[], requested: string[]): string[] {
  const allowed = new Set(base);
  return requested.filter((t) => allowed.has(t));
}

/**
 * Extract all text from a message's content parts for scanning.
 */
function extractText(parts: ContentPart[]): string {
  return parts
    .filter((p): p is Extract<ContentPart, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join(" ");
}

/**
 * Run keyword-based safety checks against text.
 */
function scanText(
  text: string,
  blockedTopics: BlockedTopic[]
): SafetyCheckResult {
  const flagged: BlockedTopic[] = [];

  for (const topic of blockedTopics) {
    const patterns = TOPIC_PATTERNS[topic];
    if (patterns?.some((re) => re.test(text))) {
      flagged.push(topic);
    }
  }

  if (flagged.length > 0) {
    return {
      safe: false,
      flaggedTopics: flagged,
      reason: `Content flagged for: ${flagged.join(", ")}`,
    };
  }

  return { safe: true, flaggedTopics: [] };
}

/**
 * Validate structural constraints (length, file types, file size, etc.)
 * before scanning content.
 */
function validateStructure(
  messages: ChatMessage[],
  config: SafetyConfig
): SafetyCheckResult {
  for (const msg of messages) {
    for (const part of msg.content) {
      if (part.type === "text" && part.text.length > config.maxInputLength) {
        return {
          safe: false,
          flaggedTopics: [],
          reason: `Input text exceeds maximum length of ${config.maxInputLength} characters`,
        };
      }

      if (part.type === "image" && !config.allowImageInput) {
        return {
          safe: false,
          flaggedTopics: [],
          reason: "Image input is not allowed by current safety configuration",
        };
      }

      if (part.type === "file") {
        if (!config.allowFileUpload) {
          return {
            safe: false,
            flaggedTopics: [],
            reason: "File upload is not allowed by current safety configuration",
          };
        }

        if (!config.allowedFileMimeTypes.includes(part.mimeType)) {
          return {
            safe: false,
            flaggedTopics: [],
            reason: `File type ${part.mimeType} is not in the allowed list`,
          };
        }

        const sizeBytes = Buffer.byteLength(part.data, "base64");
        if (sizeBytes > config.maxFileSizeBytes) {
          return {
            safe: false,
            flaggedTopics: [],
            reason: `File size exceeds maximum of ${config.maxFileSizeBytes} bytes`,
          };
        }
      }
    }
  }

  return { safe: true, flaggedTopics: [] };
}

/**
 * Check inbound user messages before they reach a model.
 */
export function checkInput(
  messages: ChatMessage[],
  config: SafetyConfig
): SafetyCheckResult {
  // 1. Structural validation
  const structResult = validateStructure(messages, config);
  if (!structResult.safe) return structResult;

  // 2. Content scanning on user messages
  const userMessages = messages.filter((m) => m.role === "user");
  for (const msg of userMessages) {
    const text = extractText(msg.content);
    const result = scanText(text, config.blockedTopics);
    if (!result.safe) return result;
  }

  return { safe: true, flaggedTopics: [] };
}

/**
 * Check model output before returning it to the student.
 */
export function checkOutput(
  message: ChatMessage,
  config: SafetyConfig
): SafetyCheckResult {
  const text = extractText(message.content);
  return scanText(text, config.blockedTopics);
}
