import type { AIRequest, AIResponse, TaskComplexity } from './types.js';

export interface EvaluationResult {
  qualityScore: number;
  shouldEscalate: boolean;
  reasons: string[];
}

export interface EvaluationThresholds {
  confidence: number;
  minLength: number;
}

const DEFAULT_THRESHOLDS: EvaluationThresholds = {
  confidence: 0.8,
  minLength: 10,
};

const UNCERTAINTY_PHRASES = [
  "I'm not sure",
  "I don't know",
  "it's possible",
  "I think",
  "maybe",
  "perhaps",
  "might be",
  "I'm uncertain",
  "it could be",
];

const COMPLEXITY_MIN_LENGTHS: Record<TaskComplexity, number> = {
  trivial: 10,
  simple: 20,
  standard: 50,
  complex: 100,
  critical: 200,
};

export class ResponseEvaluator {
  /**
   * Evaluates response quality and determines if escalation is needed.
   *
   * Quality scoring starts at 1.0 and applies penalties for various issues:
   * - Uncertainty phrases: -0.15 each (max -0.30)
   * - Insufficient length: -0.20
   * - Empty/error response: -0.50
   * - Missing code blocks (for code tasks): -0.10
   *
   * Escalation triggers when:
   * - Quality score < confidence threshold (default 0.8)
   * - Complexity is standard or higher
   * - Response was not already escalated
   */
  evaluate(
    request: AIRequest,
    response: AIResponse,
    complexity: TaskComplexity,
    thresholds?: Partial<EvaluationThresholds>
  ): EvaluationResult {
    const effectiveThresholds: EvaluationThresholds = {
      ...DEFAULT_THRESHOLDS,
      ...thresholds,
    };

    let qualityScore = 1.0;
    const reasons: string[] = [];

    // 1. Uncertainty detection
    const uncertaintyPenalty = this.evaluateUncertainty(
      response.content,
      reasons
    );
    qualityScore -= uncertaintyPenalty;

    // 2. Response length vs complexity
    const lengthPenalty = this.evaluateLength(
      response.content,
      complexity,
      reasons
    );
    qualityScore -= lengthPenalty;

    // 3. Empty or error response
    const errorPenalty = this.evaluateErrors(
      response.content,
      reasons
    );
    qualityScore -= errorPenalty;

    // 4. Structural issues for code tasks
    const structurePenalty = this.evaluateStructure(
      request.category,
      response.content,
      reasons
    );
    qualityScore -= structurePenalty;

    // Clamp score to [0, 1]
    qualityScore = Math.max(0, Math.min(1, qualityScore));

    // Determine if escalation is needed
    const shouldEscalate = this.shouldEscalateResponse(
      qualityScore,
      complexity,
      response.escalated,
      effectiveThresholds.confidence
    );

    return {
      qualityScore,
      shouldEscalate,
      reasons,
    };
  }

  private evaluateUncertainty(content: string, reasons: string[]): number {
    const contentLower = content.toLowerCase();
    let uncertaintyCount = 0;

    for (const phrase of UNCERTAINTY_PHRASES) {
      if (contentLower.includes(phrase.toLowerCase())) {
        uncertaintyCount++;
        if (uncertaintyCount === 1) {
          reasons.push('Response contains uncertainty phrases');
        }
      }
    }

    // Max penalty of -0.30 (2 instances)
    const penalty = Math.min(uncertaintyCount * 0.15, 0.30);
    return penalty;
  }

  private evaluateLength(
    content: string,
    complexity: TaskComplexity,
    reasons: string[]
  ): number {
    const minLength = COMPLEXITY_MIN_LENGTHS[complexity];
    const actualLength = content.length;

    if (actualLength < minLength) {
      reasons.push(
        `Response too short for ${complexity} task (${actualLength} < ${minLength} chars)`
      );
      return 0.20;
    }

    return 0;
  }

  private evaluateErrors(content: string, reasons: string[]): number {
    if (content.length === 0) {
      reasons.push('Response is empty');
      return 0.50;
    }

    if (content.startsWith('Error:')) {
      reasons.push('Response indicates an error');
      return 0.50;
    }

    return 0;
  }

  private evaluateStructure(
    category: AIRequest['category'],
    content: string,
    reasons: string[]
  ): number {
    const isCodeTask = category === 'code_generation' || category === 'code_review';

    if (isCodeTask && !content.includes('```')) {
      reasons.push('Code task response missing code blocks');
      return 0.10;
    }

    return 0;
  }

  private shouldEscalateResponse(
    qualityScore: number,
    complexity: TaskComplexity,
    alreadyEscalated: boolean | undefined,
    confidenceThreshold: number
  ): boolean {
    // Don't escalate if already escalated
    if (alreadyEscalated) {
      return false;
    }

    // Only escalate standard or higher complexity tasks
    const escalatableComplexity =
      complexity === 'standard' ||
      complexity === 'complex' ||
      complexity === 'critical';

    if (!escalatableComplexity) {
      return false;
    }

    // Escalate if quality score is below confidence threshold
    return qualityScore < confidenceThreshold;
  }
}
