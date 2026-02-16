import type { Context } from 'grammy';
import { generateDiagram, getAvailableTypes } from '../../../skills/diagram-generator.js';
import type { DiagramType } from '../../../skills/diagram-generator.js';

// ═══════════════════════════════════════════════════════════════════════════════
// /diagram — Generate and display architecture diagrams
// ═══════════════════════════════════════════════════════════════════════════════

export async function handleDiagram(ctx: Context): Promise<void> {
  const text = ctx.message?.text ?? '';
  const args = text.replace(/^\/diagram\s*/i, '').trim();
  const type = args.toLowerCase() || 'layers';

  const validTypes = getAvailableTypes();
  if (!validTypes.includes(type)) {
    await ctx.reply(
      `Unknown diagram type: <code>${type}</code>\n\nAvailable:\n${validTypes.map((t) => `  <code>/diagram ${t}</code>`).join('\n')}`,
      { parse_mode: 'HTML' },
    );
    return;
  }

  // "all" would be too long for Telegram — list available instead
  if (type === 'all') {
    await ctx.reply(
      `Telegram messages have size limits. Pick a specific type:\n\n${validTypes.filter((t) => t !== 'all').map((t) => `  <code>/diagram ${t}</code>`).join('\n')}`,
      { parse_mode: 'HTML' },
    );
    return;
  }

  const [diagram] = generateDiagram(type as DiagramType);

  // Mermaid doesn't render in Telegram, so send as code block
  const message = `<b>${diagram.title}</b>\n\n<pre>${escapeHtml(diagram.mermaid)}</pre>\n\n<i>Paste into mermaid.live or GitHub markdown to render.</i>`;

  // Telegram message limit is 4096 chars
  if (message.length > 4096) {
    const truncated = `<b>${diagram.title}</b>\n\n<pre>${escapeHtml(diagram.mermaid.slice(0, 3500))}</pre>\n\n<i>Truncated. Use CLI: npx ari diagram ${type}</i>`;
    await ctx.reply(truncated, { parse_mode: 'HTML' });
  } else {
    await ctx.reply(message, { parse_mode: 'HTML' });
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
