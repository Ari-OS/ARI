import type { Context } from 'grammy';
import type { PerplexityClient } from '../../../integrations/perplexity/client.js';
import { formatForTelegram, splitTelegramMessage } from '../format.js';
import { humanizeQuick } from '../../content-engine/humanizer.js';

// ═══════════════════════════════════════════════════════════════════════════════
// /search — Web search with Perplexity AI
// ═══════════════════════════════════════════════════════════════════════════════

export async function handleSearch(
  ctx: Context,
  perplexityClient: PerplexityClient | null,
): Promise<void> {
  const text = ctx.message?.text ?? '';
  const query = text.replace(/^\/search\s*/i, '').trim();

  if (!query) {
    await ctx.reply(
      '<b>Web Search</b>\n\n' +
      'Usage: <code>/search [query]</code>\n\n' +
      'Examples:\n' +
      '<code>/search TypeScript best practices</code>\n' +
      '<code>/search latest news on AI</code>',
      { parse_mode: 'HTML' },
    );
    return;
  }

  if (!perplexityClient) {
    await ctx.reply('Search requires PERPLEXITY_API_KEY to be configured.');
    return;
  }

  try {
    await ctx.reply('Searching...', { parse_mode: 'HTML' });

    const result = await perplexityClient.search(query);

    const lines: string[] = [];
    lines.push(`<b>Search Results:</b> ${query}`);
    lines.push('');
    // Humanize then format — strips AI-speak before display
    lines.push(formatForTelegram(humanizeQuick(result.answer)));

    if (result.citations.length > 0) {
      lines.push('');
      lines.push('<b>Sources:</b>');
      for (const citation of result.citations.slice(0, 5)) {
        lines.push(`  - ${citation}`);
      }
    }

    const response = lines.join('\n');
    const chunks = splitTelegramMessage(response);
    for (const chunk of chunks) {
      await ctx.reply(chunk, { parse_mode: 'HTML' });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await ctx.reply(`Search failed: ${message}`);
  }
}
