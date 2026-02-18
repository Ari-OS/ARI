import type { Context } from 'grammy';
import type { EventBus } from '../../../kernel/event-bus.js';
import { splitTelegramMessage } from '../format.js';

// ═══════════════════════════════════════════════════════════════════════════════
// /memory — Store, recall, and manage memory
// ═══════════════════════════════════════════════════════════════════════════════

export async function handleMemory(
  ctx: Context,
  eventBus: EventBus,
): Promise<void> {
  const text = ctx.message?.text ?? '';
  const args = text.replace(/^\/memory\s*/i, '').trim();

  if (!args) {
    await ctx.reply(
      '<b>Memory Management</b>\n\n' +
      'Usage:\n' +
      '<code>/memory store [text]</code> — Save to knowledge\n' +
      '<code>/memory recall [query]</code> — Search memory\n' +
      '<code>/memory stats</code> — Memory statistics',
      { parse_mode: 'HTML' },
    );
    return;
  }

  try {
    const { KnowledgeIndex } = await import('../../../autonomous/knowledge-index.js');
    const knowledgeIndex = new KnowledgeIndex(eventBus);
    await knowledgeIndex.init();

    const parts = args.split(/\s+/);
    const subcommand = parts[0].toLowerCase();
    const content = args.replace(/^\S+\s*/, '').trim();

    if (subcommand === 'store') {
      if (!content) {
        await ctx.reply('Usage: <code>/memory store [text]</code>', { parse_mode: 'HTML' });
        return;
      }

      const userId = ctx.from?.id ?? 'unknown';
      const docId = await knowledgeIndex.index({
        content,
        source: 'telegram',
        domain: 'user-notes',
        tags: ['telegram', 'user-input'],
        provenance: {
          createdBy: `telegram-user-${userId}`,
          createdAt: new Date(),
        },
      });

      await ctx.reply(
        `<b>Memory Stored</b>\n\nSaved as: <code>${docId}</code>`,
        { parse_mode: 'HTML' },
      );

      eventBus.emit('telegram:memory_stored', {
        userId,
        docId,
        contentLength: content.length,
      });
      return;
    }

    if (subcommand === 'recall') {
      if (!content) {
        await ctx.reply('Usage: <code>/memory recall [query]</code>', { parse_mode: 'HTML' });
        return;
      }

      const results = await knowledgeIndex.search(content, { limit: 5 });

      if (results.length === 0) {
        await ctx.reply(`No memories found for: <i>${content}</i>`, { parse_mode: 'HTML' });
        return;
      }

      const lines: string[] = [`<b>Recalled Memories:</b> ${content}`, ''];

      for (const result of results) {
        const score = (result.score * 100).toFixed(1);
        lines.push(`<b>Match ${score}%</b>`);
        if (result.snippet) {
          lines.push(`<i>${result.snippet}</i>`);
        }
        lines.push('');
      }

      const response = lines.join('\n');
      const chunks = splitTelegramMessage(response);
      for (const chunk of chunks) {
        await ctx.reply(chunk, { parse_mode: 'HTML' });
      }

      eventBus.emit('telegram:memory_recalled', {
        userId: ctx.from?.id,
        query: content,
        resultCount: results.length,
      });
      return;
    }

    if (subcommand === 'stats') {
      const stats = knowledgeIndex.getStats();
      const lines: string[] = ['<b>Memory Statistics</b>', ''];
      lines.push(`Total memories: ${stats.documentCount}`);
      lines.push(`Indexed terms: ${stats.termCount}`);
      lines.push('');
      lines.push('<b>By domain:</b>');
      for (const [domain, count] of Object.entries(stats.domains)) {
        lines.push(`  ${domain}: ${count}`);
      }

      await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
      return;
    }

    await ctx.reply('Unknown subcommand. Use <code>/memory</code> for help.', {
      parse_mode: 'HTML',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await ctx.reply(`Error: ${message}`);
  }
}
