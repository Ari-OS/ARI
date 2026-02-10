/**
 * Content Validation Pipeline
 *
 * 5-stage validation process for external knowledge content:
 * 1. WHITELIST - Source must be in known sources
 * 2. SANITIZE - Check for injection patterns
 * 3. BIAS_CHECK - Run bias detection on content
 * 4. FACT_CHECK - Lightweight consistency check
 * 5. HUMAN_REVIEW - Route based on trust level
 *
 * @module cognition/knowledge/content-validator
 * @version 1.0.0
 */

import type { ValidationResult } from '../types.js';
import { detectCognitiveBias } from '../ethos/index.js';

// =============================================================================
// TYPES
// =============================================================================

interface ValidationInput {
  sourceId: string;
  contentId: string;
  content: string;
  trustLevel?: string;
}

// =============================================================================
// INJECTION PATTERNS (LOCAL - DO NOT IMPORT FROM KERNEL)
// =============================================================================

// Note: Layer 0 (cognitive) cannot import from Layer 1 (kernel).
// We replicate key injection patterns locally for content validation.
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /you\s+are\s+now\s+/i,
  /reveal\s+(your\s+)?(system\s+)?(prompt|instructions|secrets)/i,
  /<script[\s>]/i,
  /\$\{.*\}/,
  /\{\{.*\}\}/,
];

// =============================================================================
// CONTENT VALIDATOR
// =============================================================================

export class ContentValidator {
  private whitelistedSourceIds: Set<string>;

  constructor(whitelistedSourceIds?: string[]) {
    this.whitelistedSourceIds = new Set(whitelistedSourceIds ?? []);
  }

  /**
   * Stage 1: Whitelist Check
   *
   * Verifies that the source is in our known sources list.
   */
  validateStage1(input: ValidationInput): ValidationResult {
    const passed = this.whitelistedSourceIds.has(input.sourceId);

    return {
      sourceId: input.sourceId,
      contentId: input.contentId,
      stage: 'WHITELIST',
      stageNumber: 1,
      passed,
      reason: passed ? 'Source is whitelisted' : 'Source not in whitelist',
      nextStage: passed ? 'SANITIZE' : undefined,
      requiresHumanReview: !passed,
      timestamp: new Date(),
    };
  }

  /**
   * Stage 2: Sanitization Check
   *
   * Checks content for injection patterns (prompt injection, script tags, etc.)
   */
  validateStage2(input: ValidationInput): ValidationResult {
    const detectedPatterns: string[] = [];

    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(input.content)) {
        detectedPatterns.push(pattern.source);
      }
    }

    const passed = detectedPatterns.length === 0;

    return {
      sourceId: input.sourceId,
      contentId: input.contentId,
      stage: 'SANITIZE',
      stageNumber: 2,
      passed,
      reason: passed
        ? 'No injection patterns detected'
        : 'Content contains injection patterns',
      details: passed ? undefined : { detectedPatterns },
      nextStage: passed ? 'BIAS_CHECK' : undefined,
      requiresHumanReview: !passed,
      timestamp: new Date(),
    };
  }

  /**
   * Stage 3: Bias Check
   *
   * Runs content through bias detection. Fails if severity > 0.7 or > 3 biases.
   * Skips empty or very short content (will be caught by fact check).
   */
  async validateStage3(input: ValidationInput): Promise<ValidationResult> {
    // Skip bias check for empty/very short content - will be caught by fact check
    if (input.content.trim().length < 50) {
      return {
        sourceId: input.sourceId,
        contentId: input.contentId,
        stage: 'BIAS_CHECK',
        stageNumber: 3,
        passed: true,
        reason: 'Content too short for bias analysis (< 50 chars)',
        nextStage: 'FACT_CHECK',
        requiresHumanReview: false,
        timestamp: new Date(),
      };
    }

    const biasResult = await detectCognitiveBias(input.content, {
      expertise: 'intermediate',
    });

    // Fail if high risk OR many biases detected OR any high-severity individual bias
    const hasHighSeverityBias = biasResult.biasesDetected.some(b => b.severity > 0.7);
    const failCondition =
      biasResult.overallRisk > 0.7 ||
      biasResult.biasesDetected.length > 3 ||
      hasHighSeverityBias;

    const passed = !failCondition;

    const reason = passed
      ? `Bias check passed (risk: ${biasResult.overallRisk.toFixed(2)})`
      : `Bias check failed: ${biasResult.biasesDetected.map(b => b.type).join(', ')}`;

    return {
      sourceId: input.sourceId,
      contentId: input.contentId,
      stage: 'BIAS_CHECK',
      stageNumber: 3,
      passed,
      reason,
      details: {
        overallRisk: biasResult.overallRisk,
        biasesDetected: biasResult.biasesDetected.map(b => ({
          type: b.type,
          severity: b.severity,
        })),
      },
      nextStage: passed ? 'FACT_CHECK' : undefined,
      requiresHumanReview: !passed,
      timestamp: new Date(),
    };
  }

  /**
   * Stage 4: Fact Check
   *
   * Lightweight consistency check (no LLM). Checks for:
   * - Non-empty content (> 50 chars)
   * - No contradictory absolute statements
   */
  validateStage4(input: ValidationInput): ValidationResult {
    const issues: string[] = [];

    // Too short = low value
    if (input.content.length < 50) {
      issues.push('Content too short (< 50 characters)');
    }

    // Check for contradictory absolutes (basic heuristic)
    const hasAlways = /\balways\b/i.test(input.content);
    const hasNever = /\bnever\b/i.test(input.content);
    const hasSameSubject = this.detectContradictoryStatements(input.content);

    if (hasAlways && hasNever && hasSameSubject) {
      issues.push('Contains contradictory absolute statements');
    }

    const passed = issues.length === 0;

    return {
      sourceId: input.sourceId,
      contentId: input.contentId,
      stage: 'FACT_CHECK',
      stageNumber: 4,
      passed,
      reason: passed ? 'Basic consistency check passed' : issues.join('; '),
      details: passed ? undefined : { issues },
      nextStage: passed ? 'HUMAN_REVIEW' : undefined,
      requiresHumanReview: !passed,
      timestamp: new Date(),
    };
  }

  /**
   * Stage 5: Human Review
   *
   * Routes content based on trust level:
   * - UNTRUSTED/HOSTILE: requiresHumanReview=true, passed=false
   * - STANDARD: requiresHumanReview=true, passed=true (proceed with flag)
   * - VERIFIED/OPERATOR/SYSTEM: auto-pass
   */
  validateStage5(input: ValidationInput): ValidationResult {
    const trustLevel = input.trustLevel?.toUpperCase() || 'STANDARD';

    let passed = true;
    let requiresHumanReview = false;
    let reason = '';

    if (trustLevel === 'UNTRUSTED' || trustLevel === 'HOSTILE') {
      passed = false;
      requiresHumanReview = true;
      reason = `Trust level ${trustLevel} requires human review before integration`;
    } else if (trustLevel === 'STANDARD') {
      passed = true;
      requiresHumanReview = true;
      reason = 'Standard trust level - flagged for human review but allowed';
    } else {
      // VERIFIED, OPERATOR, SYSTEM
      passed = true;
      requiresHumanReview = false;
      reason = `Trust level ${trustLevel} - auto-approved`;
    }

    return {
      sourceId: input.sourceId,
      contentId: input.contentId,
      stage: 'HUMAN_REVIEW',
      stageNumber: 5,
      passed,
      reason,
      details: { trustLevel },
      nextStage: undefined, // Final stage
      requiresHumanReview,
      timestamp: new Date(),
    };
  }

  /**
   * Run all 5 stages sequentially
   *
   * Stops at first failure and returns that result.
   * If all pass, returns stage 5 result.
   */
  async validate(input: ValidationInput): Promise<ValidationResult> {
    // Stage 1: Whitelist
    const stage1 = this.validateStage1(input);
    if (!stage1.passed) return stage1;

    // Stage 2: Sanitize
    const stage2 = this.validateStage2(input);
    if (!stage2.passed) return stage2;

    // Stage 3: Bias Check (async — calls detectCognitiveBias)
    const stage3 = await this.validateStage3(input);
    if (!stage3.passed) return stage3;

    // Stage 4: Fact Check
    const stage4 = this.validateStage4(input);
    if (!stage4.passed) return stage4;

    // Stage 5: Human Review (final)
    return this.validateStage5(input);
  }

  /**
   * Helper: Detect contradictory statements (basic heuristic)
   *
   * Checks if "always" and "never" appear near similar subjects.
   */
  private detectContradictoryStatements(content: string): boolean {
    const alwaysMatch = content.match(/\balways\s+(\w+)/i);
    const neverMatch = content.match(/\bnever\s+(\w+)/i);

    if (!alwaysMatch || !neverMatch) return false;

    // Simple heuristic: if the words after always/never are similar
    const alwaysWord = alwaysMatch[1].toLowerCase();
    const neverWord = neverMatch[1].toLowerCase();

    return alwaysWord === neverWord;
  }
}
