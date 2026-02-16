import type { Context } from 'grammy';
import type { EventBus } from '../../../kernel/event-bus.js';

// ═══════════════════════════════════════════════════════════════════════════════
// /knowledge — Search knowledge base and view stats
// ═══════════════════════════════════════════════════════════════════════════════

export async function handleKnowledge(
  ctx: Context,
  eventBus: EventBus,
): Promise<void> {
  const text = ctx.message?.text ?? '';
  const args = text.replace(/^\/knowledge\s*/i, '').trim();

  if (!args) {
    await ctx.reply(
      '<b>Knowledge Base</b>\n\n' +
      'Usage:\n' +
      '<code>/knowledge search [query]</code> — Search knowledge\n' +
      '<code>/knowledge stats</code> — Index statistics',
      { parse_mode: 'HTML' },
    );
    return;
  }

  try {
    const { KnowledgeIndex } = await import('../../../autonomous/knowledge-index.js');
    const knowledgeIndex = new KnowledgeIndex(eventBus);
    await knowledgeIndex.init();

    const subcommand = args.split(/\s+/)[0].toLowerCase();
    const query = args.replace(/^\S+\s*/, '').trim();

    if (subcommand === 'stats') {
      const stats = knowledgeIndex.getStats();
      const lines: string[] = ['<b>Knowledge Base Statistics</b>', ''];
      lines.push(`Documents: ${stats.documentCount}`);
      lines.push(`Terms: ${stats.termCount}`);
      lines.push('');
      lines.push('<b>Domains:</b>');
      for (const [domain, count] of Object.entries(stats.domains)) {
        lines.push(`  ${domain}: ${count}`);
      }

      await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
      return;
    }

    if (subcommand === 'search') {
      if (!query) {
        await ctx.reply('Usage: <code>/knowledge search [query]</code>', { parse_mode: 'HTML' });
        return;
      }

      const results = await knowledgeIndex.search(query, { limit: 5 });

      if (results.length === 0) {
        await ctx.reply(`No results found for: <i>${query}</i>`, { parse_mode: 'HTML' });
        return;
      }

      const lines: string[] = [`<b>Search Results:</b> ${query}`, ''];

      for (const result of results) {
        const title = result.document.title || 'Untitled';
        const score = (result.score * 100).toFixed(1);
        lines.push(`<b>${title}</b> (${score}%)`);
        if (result.snippet) {
          lines.push(`<i>${result.snippet}</i>`);
        }
        lines.push('');
      }

      const response = lines.join('\n');

      // Telegram has a 4096 character limit
      if (response.length > 4000) {
        const truncated = response.slice(0, 3900) + '\n\n... (truncated)';
        await ctx.reply(truncated, { parse_mode: 'HTML' });
      } else {
        await ctx.reply(response, { parse_mode: 'HTML' });
      }

      eventBus.emit('telegram:knowledge_searched', {
        userId: ctx.from?.id,
        query,
        resultCount: results.length,
      });
      return;
    }

    await ctx.reply('Unknown subcommand. Use <code>/knowledge</code> for help.', {
      parse_mode: 'HTML',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await ctx.reply(`Error: ${message}`);
  }
}
