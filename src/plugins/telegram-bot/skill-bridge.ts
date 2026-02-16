/**
 * Skill Bridge for Telegram Bot
 *
 * Connects SkillRegistry to Telegram, allowing natural language skill invocation.
 *
 * Layer: L6 Interfaces → L3 Agents (via dynamic import to avoid layer violation)
 */

import type { Context } from 'grammy';
import type { EventBus } from '../../kernel/event-bus.js';
import type { SkillRegistry } from '../../skills/registry.js';

export interface SkillBridgeDeps {
  eventBus: EventBus;
}

/**
 * Bridge between Telegram and SkillRegistry
 */
export class SkillBridge {
  private skillRegistry: SkillRegistry | null = null;

  constructor(private readonly deps: SkillBridgeDeps) {}

  /**
   * Set the skill registry (injected from agent layer)
   */
  setRegistry(registry: SkillRegistry): void {
    this.skillRegistry = registry;
  }

  /**
   * Handle skill query from Telegram message
   *
   * @param ctx - grammY context
   * @param query - User input text
   * @returns True if skill was matched and invoked, false otherwise
   */
  async handleSkillQuery(ctx: Context, query: string): Promise<boolean> {
    if (!this.skillRegistry) {
      return false;
    }

    try {
      const match = this.skillRegistry.findBestMatch(query);

      // Require 70% confidence threshold
      if (!match || match.confidence < 0.7) {
        return false;
      }

      this.deps.eventBus.emit('telegram:skill_invoked', {
        skill: match.skill.metadata.name,
        confidence: match.confidence,
        timestamp: new Date().toISOString(),
      });

      await ctx.reply(
        `<b>Skill: ${match.skill.metadata.displayName ?? match.skill.metadata.name}</b>\n` +
        `<i>${match.skill.metadata.description}</i>\n\n` +
        `Confidence: ${Math.round(match.confidence * 100)}%`,
        { parse_mode: 'HTML' },
      );

      return true;
    } catch (error: unknown) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.deps.eventBus.emit('system:error', {
        error: errorObj,
        context: 'skill_bridge',
      });
      return false;
    }
  }
}
