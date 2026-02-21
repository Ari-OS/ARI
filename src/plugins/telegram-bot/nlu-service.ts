import type { AIOrchestrator } from '../../ai/orchestrator.js';
import type { ConversationEntry } from './conversation-store.js';
import { createLogger } from '../../kernel/logger.js';

const log = createLogger('nlu-service');

export interface NLUIntent {
  intent: string;
  confidence: number;
  entities: Record<string, string | number | boolean>;
}

export interface NLUResult {
  primaryIntent: NLUIntent;
  secondaryIntents: NLUIntent[];
  context: {
    resolvedReferences: Record<string, string>;
    implicitTime?: string;
  };
  isCompound: boolean;
}

export class NLUService {
  constructor(private orchestrator: AIOrchestrator | null) {}

  /**
   * Analyzes the user's message and extracts structured intent, entities, and context.
   */
  async analyze(
    text: string,
    availableIntents: string[],
    history: ConversationEntry[] = []
  ): Promise<NLUResult | null> {
    if (!this.orchestrator) return null;

    const recentContext = history
      .slice(-5)
      .map(m => `${m.role}: ${m.content.slice(0, 100)}`)
      .join('\n');
      
    const contextSection = recentContext
      ? `\nConversation context (last ${Math.min(history.length, 5)} messages):\n${recentContext}\n`
      : '';

    const prompt = `Analyze the user's message and extract structured intent data.

Available intents: ${availableIntents.join(', ')}, conversational
${contextSection}

User message: "${text.slice(0, 300)}"

Respond ONLY with a valid JSON object matching this schema:
{
  "primaryIntent": {
    "intent": "string (one of the available intents)",
    "confidence": 0.0 to 1.0,
    "entities": {
      "key": "value (e.g. dates, names, priorities, amounts)"
    }
  },
  "secondaryIntents": [
    // If the user asked for multiple actions (compound command), list them here.
    // E.g. "Add a task to buy milk and remind me tomorrow" -> task_add, reminder_create
  ],
  "context": {
    "resolvedReferences": {
      // If the user used pronouns like "it", "that", "him", resolve them based on the conversation context.
      // E.g. {"it": "the proposal"}
    },
    "implicitTime": "resolved time if implied, e.g. tomorrow morning"
  },
  "isCompound": boolean (true if multiple distinct actions requested)
}`;

    try {
      const response = await this.orchestrator.chat(
        [{ role: 'user', content: prompt }],
        'You are an advanced Natural Language Understanding (NLU) service. You extract precise intents, entities, and contextual references from natural conversation. Output strictly valid JSON without markdown wrapping.',
        'core'
      );

      // Strip potential markdown JSON wrapping from Claude responses
      const cleanResponse = response.replace(/```json\n?/g, '').replace(/```/g, '').trim();
      
      const parsed = JSON.parse(cleanResponse) as NLUResult;
      
      // Basic validation
      if (!parsed.primaryIntent || !parsed.primaryIntent.intent) {
        throw new Error('Invalid NLU result structure');
      }

      return parsed;
    } catch (err) {
      log.error({ err }, 'NLU classification failed');
      return null;
    }
  }
}
