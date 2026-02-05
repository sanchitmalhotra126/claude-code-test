/**
 * Safety configuration for the chatbot API.
 *
 * All defaults are tuned for middle-school students (ages 10-14).
 * API consumers can tighten but not loosen beyond the platform minimum.
 */

export type SafetyLevel = "strict" | "moderate";

/** Topic categories that can be blocked. */
export type BlockedTopic =
  | "violence"
  | "sexual_content"
  | "self_harm"
  | "hate_speech"
  | "drugs_alcohol"
  | "profanity"
  | "personal_information"
  | "dangerous_activities"
  | "academic_dishonesty";

export interface SafetyConfig {
  /** Overall strictness. Defaults to "strict". */
  level: SafetyLevel;

  /**
   * Topics to block in both input and output.
   * Defaults to ALL topics for middle-school context.
   */
  blockedTopics: BlockedTopic[];

  /** Max input length in characters. Prevents prompt-injection attempts. */
  maxInputLength: number;

  /** Max output tokens returned by the model. */
  maxOutputTokens: number;

  /** Whether to allow image inputs. */
  allowImageInput: boolean;

  /** Whether to allow file uploads. */
  allowFileUpload: boolean;

  /** Allowed file MIME types when file upload is enabled. */
  allowedFileMimeTypes: string[];

  /** Max file size in bytes. */
  maxFileSizeBytes: number;

  /** Custom system prompt prepended to every request for safety framing. */
  systemPromptPrefix: string;
}

export const DEFAULT_SAFETY_CONFIG: SafetyConfig = {
  level: "strict",
  blockedTopics: [
    "violence",
    "sexual_content",
    "self_harm",
    "hate_speech",
    "drugs_alcohol",
    "profanity",
    "personal_information",
    "dangerous_activities",
    "academic_dishonesty",
  ],
  maxInputLength: 2000,
  maxOutputTokens: 1024,
  allowImageInput: true,
  allowFileUpload: true,
  allowedFileMimeTypes: [
    "application/pdf",
    "text/plain",
    "image/png",
    "image/jpeg",
  ],
  maxFileSizeBytes: 5 * 1024 * 1024, // 5 MB
  systemPromptPrefix: [
    "You are a helpful educational assistant for middle school students (ages 10-14).",
    "Always provide age-appropriate, safe, and educational responses.",
    "Never produce content involving violence, sexual themes, self-harm, hate speech, drugs, alcohol, or profanity.",
    "Do not ask for or reveal personal information such as full names, addresses, phone numbers, or school names.",
    "If a student asks about dangerous activities, redirect them to speak with a trusted adult.",
    "Do not help with cheating or academic dishonesty. Guide students toward understanding rather than giving direct answers.",
    "Keep language simple, encouraging, and supportive.",
  ].join(" "),
};

/** Result of a safety check — either clean or flagged. */
export interface SafetyCheckResult {
  safe: boolean;
  /** Which topics were flagged, if any. */
  flaggedTopics: BlockedTopic[];
  /** Human-readable reason when blocked. */
  reason?: string;
}
