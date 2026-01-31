/**
 * ARI Prompt Builder
 *
 * Implements Anthropic's 10-step prompt structure for optimal results.
 * This systematic approach ensures prompts are well-organized and
 * Claude can process them effectively.
 *
 * The 10 steps (in optimal order):
 * 1. Task Context - What problem we're solving
 * 2. Tone Context - Communication style
 * 3. Background Data - Reference materials
 * 4. Detailed Task Description - Specific requirements
 * 5. Examples - Demonstrations of expected output
 * 6. Conversation History - Prior context (if any)
 * 7. Immediate Action - What to do right now
 * 8. Deep Thinking - Encourage reasoning
 * 9. Output Formatting - Structure of response
 * 10. Prefilled Response - Start the response
 */

export interface PromptSection {
  label: string;
  content: string;
  required?: boolean;
}

export interface PromptConfig {
  taskContext?: string;
  toneContext?: string;
  backgroundData?: string[];
  detailedTask?: string;
  examples?: Array<{ input: string; output: string }>;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  immediateAction?: string;
  encourageThinking?: boolean;
  outputFormat?: string;
  prefillResponse?: string;
}

export interface BuiltPrompt {
  systemPrompt: string;
  userMessage: string;
  assistantPrefill?: string;
}

/**
 * Build a prompt following Anthropic's 10-step structure
 */
export class PromptBuilder {
  private config: PromptConfig = {};

  /**
   * Step 1: Set task context
   * What problem are we solving? Why is this being done?
   */
  taskContext(context: string): PromptBuilder {
    this.config.taskContext = context;
    return this;
  }

  /**
   * Step 2: Set tone context
   * How should the response be communicated?
   */
  toneContext(tone: string): PromptBuilder {
    this.config.toneContext = tone;
    return this;
  }

  /**
   * Step 3: Add background data
   * Reference materials, documentation, prior knowledge
   */
  backgroundData(data: string[]): PromptBuilder {
    this.config.backgroundData = data;
    return this;
  }

  /**
   * Step 4: Set detailed task description
   * Specific requirements and constraints
   */
  detailedTask(task: string): PromptBuilder {
    this.config.detailedTask = task;
    return this;
  }

  /**
   * Step 5: Add examples
   * Input/output demonstrations
   */
  examples(examples: Array<{ input: string; output: string }>): PromptBuilder {
    this.config.examples = examples;
    return this;
  }

  /**
   * Step 6: Set conversation history
   * Prior messages for context
   */
  conversationHistory(
    history: Array<{ role: 'user' | 'assistant'; content: string }>
  ): PromptBuilder {
    this.config.conversationHistory = history;
    return this;
  }

  /**
   * Step 7: Set immediate action
   * What should Claude do right now?
   */
  immediateAction(action: string): PromptBuilder {
    this.config.immediateAction = action;
    return this;
  }

  /**
   * Step 8: Encourage deep thinking
   * Add prompts for reasoning
   */
  encourageThinking(enable: boolean = true): PromptBuilder {
    this.config.encourageThinking = enable;
    return this;
  }

  /**
   * Step 9: Set output format
   * Structure of the expected response
   */
  outputFormat(format: string): PromptBuilder {
    this.config.outputFormat = format;
    return this;
  }

  /**
   * Step 10: Set prefilled response
   * Start Claude's response with specific text
   */
  prefillResponse(prefill: string): PromptBuilder {
    this.config.prefillResponse = prefill;
    return this;
  }

  /**
   * Build the complete prompt
   */
  build(): BuiltPrompt {
    const systemParts: string[] = [];

    // Step 1: Task Context
    if (this.config.taskContext) {
      systemParts.push(`## Task Context\n\n${this.config.taskContext}`);
    }

    // Step 2: Tone Context
    if (this.config.toneContext) {
      systemParts.push(`## Communication Style\n\n${this.config.toneContext}`);
    }

    // Step 3: Background Data
    if (this.config.backgroundData && this.config.backgroundData.length > 0) {
      systemParts.push(
        `## Background Information\n\n${this.config.backgroundData.map((d) => `- ${d}`).join('\n')}`
      );
    }

    // Step 4: Detailed Task (in user message)
    // Step 5: Examples
    if (this.config.examples && this.config.examples.length > 0) {
      const exampleText = this.config.examples
        .map(
          (ex, i) =>
            `### Example ${i + 1}\n\n**Input:**\n${ex.input}\n\n**Output:**\n${ex.output}`
        )
        .join('\n\n');
      systemParts.push(`## Examples\n\n${exampleText}`);
    }

    // Step 8: Deep Thinking
    if (this.config.encourageThinking) {
      systemParts.push(
        `## Approach\n\nThink through this step by step. Consider multiple approaches before settling on the best solution. Explain your reasoning.`
      );
    }

    // Step 9: Output Format
    if (this.config.outputFormat) {
      systemParts.push(`## Output Format\n\n${this.config.outputFormat}`);
    }

    // Build user message
    const userParts: string[] = [];

    // Step 6: Conversation History (summarized in user message if present)
    if (
      this.config.conversationHistory &&
      this.config.conversationHistory.length > 0
    ) {
      const historyText = this.config.conversationHistory
        .map((msg) => `**${msg.role}:** ${msg.content}`)
        .join('\n\n');
      userParts.push(`## Previous Context\n\n${historyText}`);
    }

    // Step 4: Detailed Task
    if (this.config.detailedTask) {
      userParts.push(this.config.detailedTask);
    }

    // Step 7: Immediate Action
    if (this.config.immediateAction) {
      userParts.push(`\n**Please:** ${this.config.immediateAction}`);
    }

    return {
      systemPrompt: systemParts.join('\n\n---\n\n'),
      userMessage: userParts.join('\n\n'),
      assistantPrefill: this.config.prefillResponse,
    };
  }

  /**
   * Build as a single string (for simple use cases)
   */
  buildAsString(): string {
    const built = this.build();
    let result = '';

    if (built.systemPrompt) {
      result += `<system>\n${built.systemPrompt}\n</system>\n\n`;
    }

    result += `<user>\n${built.userMessage}\n</user>`;

    if (built.assistantPrefill) {
      result += `\n\n<assistant>\n${built.assistantPrefill}`;
    }

    return result;
  }

  /**
   * Reset the builder for reuse
   */
  reset(): PromptBuilder {
    this.config = {};
    return this;
  }

  /**
   * Clone the current builder state
   */
  clone(): PromptBuilder {
    const cloned = new PromptBuilder();
    cloned.config = { ...this.config };
    if (this.config.backgroundData) {
      cloned.config.backgroundData = [...this.config.backgroundData];
    }
    if (this.config.examples) {
      cloned.config.examples = [...this.config.examples];
    }
    if (this.config.conversationHistory) {
      cloned.config.conversationHistory = [...this.config.conversationHistory];
    }
    return cloned;
  }
}

/**
 * Quick builder factory
 */
export function createPrompt(): PromptBuilder {
  return new PromptBuilder();
}

/**
 * Preset prompts for common ARI tasks
 */
export const PromptPresets = {
  /**
   * Task analysis prompt
   */
  taskAnalysis: () =>
    createPrompt()
      .taskContext('Analyze a task to determine execution strategy')
      .toneContext('Technical but clear. Focus on actionable insights.')
      .outputFormat(`Respond with:
1. Task Type (query/action/analysis)
2. Required Tools (list)
3. Risk Level (low/medium/high)
4. Suggested Approach (3-5 steps)`)
      .encourageThinking(true),

  /**
   * Code review prompt
   */
  codeReview: () =>
    createPrompt()
      .taskContext('Review code for bugs, security issues, and improvements')
      .toneContext('Constructive and specific. Cite line numbers.')
      .outputFormat(`For each issue found:
- Location (file:line)
- Severity (critical/major/minor/suggestion)
- Description
- Suggested fix`)
      .encourageThinking(true),

  /**
   * Daily briefing prompt
   */
  dailyBriefing: () =>
    createPrompt()
      .taskContext('Generate a daily briefing summary')
      .toneContext('Professional, concise, respectful of time')
      .outputFormat(`Structure:
## Summary (2-3 sentences)
## Key Metrics
## Action Items
## Concerns (if any)`)
      .prefillResponse('## Summary\n\n'),

  /**
   * Changelog generation prompt
   */
  changelogGeneration: () =>
    createPrompt()
      .taskContext('Generate changelog entries from git commits')
      .toneContext('Clear, user-focused, following Keep a Changelog format')
      .outputFormat(`Categories:
- Added: New features
- Changed: Changes to existing functionality
- Deprecated: Features that will be removed
- Removed: Features removed
- Fixed: Bug fixes
- Security: Security updates`)
      .prefillResponse('## [Unreleased]\n\n'),
};
