import { createLogger } from '../../kernel/logger.js';

const log = createLogger('content-revision-engine');

export interface RevisionRequest {
  draftContent: string;
  platform: string;
  headline: string;
  feedback: string;
  version: number;
}

export interface RevisionResult {
  revisedContent: string;
  changesDescription: string;
  version: number;
}

export class RevisionEngine {
  constructor(
    private orchestrator: {
      chat: (
        messages: Array<{ role: string; content: string }>,
        systemPrompt?: string,
      ) => Promise<string>;
    },
  ) {}

  async revise(request: RevisionRequest): Promise<RevisionResult> {
    const systemPrompt = `You are a content editor for the PayThePryce brand. You revise content drafts based on feedback.
Rules:
- Maintain the original voice (direct, no filler, confident)
- Apply the feedback precisely
- Keep platform constraints (X: 280 chars, LinkedIn: 1300 chars, blog: no limit)
- Return ONLY the revised content, no explanations`;

    const userPrompt = `Platform: ${request.platform}
Headline: ${request.headline}
Version: ${request.version}

Current draft:
${request.draftContent}

Feedback to apply:
${request.feedback}

Revise the draft incorporating the feedback. Return only the revised content.`;

    try {
      const revised = await this.orchestrator.chat(
        [{ role: 'user', content: userPrompt }],
        systemPrompt,
      );

      return {
        revisedContent: revised.trim(),
        changesDescription: `Applied feedback: "${request.feedback.slice(0, 100)}${request.feedback.length > 100 ? '...' : ''}"`,
        version: request.version + 1,
      };
    } catch (error) {
      log.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Revision failed',
      );
      throw new Error(
        `Failed to revise draft: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
