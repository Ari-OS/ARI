/**
 * ARI vNext — Prompt Refiner
 *
 * Deterministic, sandboxed prompt refiner for TRUSTED operator input only.
 * NO authority, NO side effects, NO tool access.
 * Pure function: text -> { refined, intent, constraints, questions }
 *
 * @module prompting/prompt-refiner
 * @version 1.0.0
 */

import { type RefinedPrompt, type Result, ok, err } from '../types/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// PATTERN DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

interface PromptPattern {
  name: string;
  pattern: RegExp;
  intentHint: string;
}

const INTENT_PATTERNS: PromptPattern[] = [
  { name: 'question', pattern: /^(what|how|why|when|where|who|which|can|does|is|are|do)\b/i, intentHint: 'information_request' },
  { name: 'command', pattern: /^(create|make|build|generate|write|add|remove|delete|update|change|fix|set|configure)\b/i, intentHint: 'action_request' },
  { name: 'search', pattern: /^(find|search|look|show|list|get)\b/i, intentHint: 'search_request' },
  { name: 'help', pattern: /^(help|explain|describe|clarify|tell me about)\b/i, intentHint: 'help_request' },
  { name: 'analysis', pattern: /^(analyze|review|evaluate|assess|compare|check)\b/i, intentHint: 'analysis_request' },
  { name: 'summary', pattern: /^(summarize|recap|tldr|brief|overview)\b/i, intentHint: 'summary_request' },
];

const CONSTRAINT_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'format_json', pattern: /\b(in json|as json|json format)\b/i },
  { name: 'format_markdown', pattern: /\b(in markdown|as markdown|markdown format)\b/i },
  { name: 'format_list', pattern: /\b(as a list|in list form|bullet points|numbered list)\b/i },
  { name: 'format_table', pattern: /\b(as a table|in table form|table format)\b/i },
  { name: 'brevity', pattern: /\b(briefly|concise|short|quick|tl;?dr)\b/i },
  { name: 'detail', pattern: /\b(detailed|thorough|comprehensive|in-depth|elaborate)\b/i },
  { name: 'code', pattern: /\b(code|script|program|function|snippet)\b/i },
  { name: 'example', pattern: /\b(example|sample|instance|demo)\b/i },
  { name: 'step_by_step', pattern: /\b(step.by.step|walkthrough|tutorial|guide)\b/i },
];

// ═══════════════════════════════════════════════════════════════════════════
// REFINER CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class PromptRefiner {
  /**
   * Refine a prompt — pure function, no side effects
   */
  refine(input: string): Result<RefinedPrompt, Error> {
    const startTime = performance.now();

    try {
      if (!input || input.trim().length === 0) {
        return err(new Error('Input prompt cannot be empty'));
      }

      const trimmed = input.trim();
      const patternsDetected: string[] = [];

      // Detect intent
      let intentGuess = 'general';
      for (const { name, pattern, intentHint } of INTENT_PATTERNS) {
        if (pattern.test(trimmed)) {
          intentGuess = intentHint;
          patternsDetected.push(`intent:${name}`);
          break;
        }
      }

      // Detect constraints
      const constraintsGuess: string[] = [];
      for (const { name, pattern } of CONSTRAINT_PATTERNS) {
        if (pattern.test(trimmed)) {
          constraintsGuess.push(name);
          patternsDetected.push(`constraint:${name}`);
        }
      }

      // Generate clarifying questions if the prompt is vague
      const questions = this.generateQuestions(trimmed, intentGuess);

      // Refine the text
      const refinedText = this.refineText(trimmed);

      // Calculate confidence based on clarity signals
      const confidence = this.calculateConfidence(trimmed, intentGuess, constraintsGuess);

      const processingTime = performance.now() - startTime;

      const result: RefinedPrompt = {
        refined_text: refinedText,
        intent_guess: intentGuess,
        constraints_guess: constraintsGuess,
        questions_if_needed: questions,
        confidence,
        metadata: {
          original_length: input.length,
          refined_length: refinedText.length,
          processing_time_ms: processingTime,
          patterns_detected: patternsDetected,
        },
      };

      return ok(result);
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Clean up and normalize prompt text
   */
  private refineText(text: string): string {
    let refined = text;

    // Normalize whitespace (collapse multiple spaces/newlines)
    refined = refined.replace(/[ \t]+/g, ' ');
    refined = refined.replace(/\n{3,}/g, '\n\n');

    // Trim each line
    refined = refined
      .split('\n')
      .map((line) => line.trim())
      .join('\n');

    // Ensure proper ending punctuation for questions
    if (/^(what|how|why|when|where|who|which|can|does|is|are|do)\b/i.test(refined)) {
      if (!/[?.!]$/.test(refined)) {
        refined += '?';
      }
    }

    return refined.trim();
  }

  /**
   * Generate clarifying questions for vague prompts
   */
  private generateQuestions(text: string, intent: string): string[] {
    const questions: string[] = [];
    const wordCount = text.split(/\s+/).length;

    // Very short prompts likely need clarification
    if (wordCount <= 3 && intent === 'general') {
      questions.push('Could you provide more context about what you need?');
    }

    // Action requests without specifics
    if (intent === 'action_request' && wordCount <= 5) {
      questions.push('What specific details or parameters should be included?');
    }

    // No clear output format
    if (intent === 'information_request' && !/\b(format|json|list|table|markdown)\b/i.test(text)) {
      questions.push('Would you like the response in a specific format?');
    }

    return questions;
  }

  /**
   * Calculate confidence score based on prompt clarity
   */
  private calculateConfidence(
    text: string,
    intent: string,
    constraints: string[],
  ): number {
    let score = 0.5; // Base score

    // Clear intent increases confidence
    if (intent !== 'general') {
      score += 0.2;
    }

    // Constraints increase confidence (explicit about what they want)
    score += Math.min(constraints.length * 0.05, 0.15);

    // Length affects confidence (too short = vague, too long = unfocused)
    const wordCount = text.split(/\s+/).length;
    if (wordCount >= 5 && wordCount <= 50) {
      score += 0.1;
    } else if (wordCount > 50 && wordCount <= 100) {
      score += 0.05;
    }

    // Proper punctuation increases confidence
    if (/[.?!]$/.test(text)) {
      score += 0.05;
    }

    return Math.min(Math.max(score, 0), 1);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON & FACTORY
// ═══════════════════════════════════════════════════════════════════════════

let refinerInstance: PromptRefiner | null = null;

export function getPromptRefiner(): PromptRefiner {
  if (refinerInstance === null) {
    refinerInstance = new PromptRefiner();
  }
  return refinerInstance;
}

export function createPromptRefiner(): PromptRefiner {
  return new PromptRefiner();
}
