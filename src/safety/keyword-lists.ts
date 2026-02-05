import { BlockedTopic } from "../types";

/**
 * Keyword / pattern lists for rule-based pre-screening.
 *
 * This is the first layer of defence — fast, deterministic, and runs before
 * any model call. A production deployment would pair this with a dedicated
 * moderation model (e.g. OpenAI Moderation, Perspective API) for higher
 * recall.
 *
 * Patterns are matched case-insensitively against the full text and are
 * designed to minimise false positives in an educational context — e.g.
 * "kill" alone is not blocked because it appears in biology ("kill bacteria"),
 * but phrases like "kill yourself" are.
 */

export const TOPIC_PATTERNS: Record<BlockedTopic, RegExp[]> = {
  violence: [
    /\bkill\s+(you|him|her|them|myself|yourself|someone)\b/i,
    /\bschool\s+shoot/i,
    /\bbomb\s+threat/i,
    /\bhow\s+to\s+(make|build)\s+(a\s+)?(weapon|bomb|gun)/i,
    /\btorture\b/i,
    /\bmurder\b/i,
  ],
  sexual_content: [
    /\bporn/i,
    /\bsexual\s+content/i,
    /\bnude/i,
    /\bexplicit\b/i,
    /\bnsfw\b/i,
  ],
  self_harm: [
    /\bkill\s+myself\b/i,
    /\bsuicid/i,
    /\bself[- ]?harm/i,
    /\bcut\s+myself\b/i,
    /\bwant\s+to\s+die\b/i,
    /\bend\s+my\s+life\b/i,
  ],
  hate_speech: [
    /\bslur/i,
    /\bhate\s+(all|every)\s+\w+/i,
    /\bracist\b/i,
    /\bhomophob/i,
    /\btransphob/i,
    /\bxenophob/i,
  ],
  drugs_alcohol: [
    /\bhow\s+to\s+(buy|get|make|use)\s+(drugs|weed|cocaine|meth|heroin|alcohol)\b/i,
    /\bget\s+(high|drunk|wasted)\b/i,
    /\bvaping\b/i,
  ],
  profanity: [
    /\bf+u+c+k+/i,
    /\bs+h+i+t+\b/i,
    /\bass+hole/i,
    /\bbitch/i,
    /\bdamn\b/i,
  ],
  personal_information: [
    /\bmy\s+(home\s+)?address\s+is\b/i,
    /\bmy\s+phone\s+(number\s+)?is\b/i,
    /\bmy\s+social\s+security/i,
    /\bmy\s+password\s+is\b/i,
    /\bssn\b/i,
  ],
  dangerous_activities: [
    /\bhow\s+to\s+(make|build)\s+(a\s+)?(fire|explosive|poison)/i,
    /\bhow\s+to\s+hack\b/i,
    /\bhow\s+to\s+steal\b/i,
    /\bhow\s+to\s+pick\s+a\s+lock/i,
  ],
  academic_dishonesty: [
    /\bwrite\s+my\s+(entire\s+)?(essay|paper|homework|assignment)\b/i,
    /\bdo\s+my\s+homework\b/i,
    /\bgive\s+me\s+the\s+answers?\b/i,
    /\bcomplete\s+this\s+(test|exam|quiz)\s+for\s+me\b/i,
  ],
};
