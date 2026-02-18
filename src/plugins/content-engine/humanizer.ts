/**
 * HUMANIZER — Strips AI-speak from ARI's responses.
 *
 * ARI should sound like Pryce talking to himself — direct, casual, smart.
 * Never corporate. Never filler. Never "certainly!" or "I hope this helps."
 *
 * Two modes:
 *   1. Rule-based (fast, free): Strips known AI phrases via regex
 *   2. AI-assisted (slow, costs tokens): Full rewrite via Claude with voice guide
 *
 * Telegram responses use rule-based only (too slow for real-time).
 * Content pipeline uses AI-assisted before approval gate.
 */

import { createLogger } from '../../kernel/logger.js';

const log = createLogger('humanizer');

// ─── Phrases that immediately identify AI-written text ────────────────────────

const AI_PHRASES: Array<[RegExp, string]> = [
  // Filler openers
  [/^Certainly[!,.]?\s*/im,                          ''],
  [/^Absolutely[!,.]?\s*/im,                         ''],
  [/^Of course[!,.]?\s*/im,                          ''],
  [/^Sure[!,.]?\s*/im,                               ''],
  [/^Great[!,.]?\s*/im,                              ''],
  [/^Excellent[!,.]?\s*/im,                          ''],
  [/^I'?d be happy to\s*/im,                         ''],
  [/^I'?m happy to help\s*/im,                       ''],
  [/^I'?ll help you with that\s*/im,                 ''],

  // Sycophantic responses
  [/^That'?s (?:a )?(?:great|excellent|good|wonderful|fantastic) question[!.]?\s*/im, ''],
  [/^What (?:a )?(?:great|interesting|excellent) (?:question|point)[!.]?\s*/im, ''],

  // Closers
  [/\bI hope (?:this|that) helps?[!.]?\s*$/im,       ''],
  [/\bLet me know if you (?:have|need) (?:any )?(?:more )?(?:questions?|help)[!.]?\s*$/im, ''],
  [/\bFeel free to (?:ask|reach out)[^.]*[.!]?\s*$/im, ''],
  [/\bDon'?t hesitate to (?:ask|reach out)[^.]*[.!]?\s*$/im, ''],
  [/\bIs there anything (?:else|more) I can (?:help|assist) (?:you )?with[?!.]?\s*$/im, ''],
  [/\bHope (?:this|that) (?:helps?|was helpful)[!.]?\s*$/im, ''],

  // Verbal hedges
  [/\bAs an AI(?:\s+(?:language\s+)?model)?,?\s*/im, ''],
  [/\bAs (?:your\s+)?AI assistant,?\s*/im,           ''],
  [/\bIt'?s important to note that\s*/im,            ''],
  [/\bIt'?s worth noting that\s*/im,                 ''],
  [/\bIt'?s (?:crucial|essential|vital) to\s*/im,    'You need to '],
  [/\bPlease note that\s*/im,                        ''],
  [/\bI would like to point out that\s*/im,          ''],

  // Filler transitions
  [/\bIn conclusion,?\s*/im,                         ''],
  [/\bIn summary,?\s*/im,                            ''],
  [/\bTo summarize,?\s*/im,                          ''],
  [/\bOverall,?\s*/im,                               ''],
  [/\bIn the realm of\s*/im,                         'In '],
  [/\bAt the end of the day,?\s*/im,                 ''],
  [/\bDelve(?:s)? into/im,                           'explore'],
  [/\bFoster(?:s|ing)?\s+(?:a\s+)?(?:deeper\s+)?understanding/im, 'understand'],
  [/\bLeverage(?:s|d)?\s+(?:the\s+)?power of/im,    'use'],
  [/\bHarness(?:es|ing)?\s+(?:the\s+)?power of/im,  'use'],
  [/\bUtilize(?:s|d)?/im,                            'use'],
  [/\bFacilitate(?:s|d)?/im,                         'help'],
  [/\bImplement(?:s|ed)?\s+a\s+(?:robust|comprehensive)\s+/im, 'implement a '],
  [/\bComprehensive\s+solution/im,                   'solution'],
  [/\bRobust\s+(?:solution|system|framework)/im,     '$1'], // remove "robust"

  // AI self-references
  [/\bAs\s+(?:an|the)\s+AI[,.]?\s*/im,              ''],
  [/\bAs\s+a\s+(?:language\s+)?model[,.]?\s*/im,    ''],
];

// ─── Sentence-level rewrite targets ──────────────────────────────────────────

/** Removes double-blank lines and excessive whitespace from stripping */
function cleanWhitespace(text: string): string {
  return text
    .replace(/\n{3,}/g, '\n\n')   // Max 2 blank lines
    .replace(/[ \t]+\n/g, '\n')   // Trailing spaces on lines
    .replace(/^\s+/, '')          // Leading whitespace
    .replace(/\s+$/, '')          // Trailing whitespace
    .replace(/\.\s*\n\n/g, '.\n\n'); // Clean up sentence endings
}

// ═══════════════════════════════════════════════════════════════════════════════
// RULE-BASED HUMANIZER (fast, free — used for Telegram responses)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Strip AI-sounding patterns from text using regex rules.
 * Fast, free, and good enough for ~70% of responses.
 * Call this on every Telegram response before sending.
 */
export function humanizeQuick(text: string): string {
  let result = text;

  for (const [pattern, replacement] of AI_PHRASES) {
    result = result.replace(pattern, replacement);
  }

  return cleanWhitespace(result);
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI-ASSISTED HUMANIZER (higher quality — used for content pipeline)
// ═══════════════════════════════════════════════════════════════════════════════

export interface HumanizerOptions {
  /** Target length in words (optional — preserves original if not set) */
  targetWords?: number;
  /** Context about what this content is for */
  context?: string;
}

/**
 * Full AI-assisted humanization using Claude with Pryce's voice guide.
 *
 * Voice characteristics:
 * - Direct and punchy — say what you mean in as few words as possible
 * - Casual but smart — like a text from a knowledgeable friend
 * - No corporate jargon — no "leverage", "synergy", "utilize"
 * - Personal — uses "I", "you", first-person perspective
 * - Opinionated — take a stance, don't hedge everything
 * - Action-oriented — tell people what to DO, not just what IS
 */
export async function humanizeWithAI(
  text: string,
  orchestrator: { query: (prompt: string, context: string) => Promise<string> },
  options: HumanizerOptions = {},
): Promise<string> {
  log.info({ textLength: text.length }, 'Humanizing content with AI');

  // Apply quick rules first to save tokens
  const quickResult = humanizeQuick(text);

  const lengthGuide = options.targetWords
    ? `Target length: ~${options.targetWords} words.`
    : 'Keep roughly the same length.';

  const contextNote = options.context
    ? `Context: ${options.context}`
    : '';

  const prompt = `Rewrite this content to sound like Pryce Hedrick wrote it — not an AI.

Voice rules:
- Direct and punchy. No filler.
- Casual but smart — like texting a smart friend.
- No "leverage", "utilize", "implement", "foster", "delve", "certainly", "absolutely".
- No corporate jargon. No buzzwords.
- No "I hope this helps" or "feel free to ask" or "as an AI".
- Use contractions (it's, you're, don't).
- Take a stance — be opinionated. Don't hedge everything.
- Talk about what people should DO, not just what IS.
- Short sentences. Variety. Mix in a punchy 4-word sentence with a longer one.
${lengthGuide}
${contextNote}

Content to rewrite:
${quickResult}

Rewritten version (only output the rewritten text, nothing else):`;

  try {
    const rewritten = await orchestrator.query(prompt, 'content');
    const cleaned = cleanWhitespace(rewritten);
    log.info({ originalLength: text.length, rewrittenLength: cleaned.length }, 'Humanization complete');
    return cleaned;
  } catch (error) {
    log.warn({ error: error instanceof Error ? error.message : String(error) }, 'AI humanization failed, using quick rules');
    return quickResult;
  }
}

// ─── Export for skill invocation ──────────────────────────────────────────────

export const humanizer = { humanizeQuick, humanizeWithAI };
