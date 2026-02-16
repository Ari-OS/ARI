import type { Context } from 'grammy';
import type { PluginRegistry } from '../../../plugins/registry.js';
import type { ContentEnginePlugin } from '../../content-engine/index.js';

// ═══════════════════════════════════════════════════════════════════════════════
// /content — Content Engine commands (drafts, approve, reject, publish)
// ═══════════════════════════════════════════════════════════════════════════════

export async function handleContent(
  ctx: Context,
  registry: PluginRegistry | null,
): Promise<void> {
  if (!registry) {
    await ctx.reply('Plugin registry not available.');
    return;
  }

  const plugin = registry.getPlugin<ContentEnginePlugin>('content-engine');
  if (!plugin || plugin.getStatus() !== 'active') {
    await ctx.reply('Content engine not available.');
    return;
  }

  const text = ctx.message?.text ?? '';
  const args = text.replace(/^\/content\s*/i, '').trim().split(/\s+/);
  const subcommand = args[0]?.toLowerCase() ?? 'drafts';

  try {
    switch (subcommand) {
      case 'drafts': {
        const pending = plugin.getDraftQueue().getPending();
        const approved = plugin.getDraftQueue().getApproved();

        if (pending.length === 0 && approved.length === 0) {
          await ctx.reply('No drafts in queue. Content generation runs daily at 7 AM.');
          return;
        }

        const lines: string[] = ['<b>Content Pipeline</b>', ''];

        if (pending.length > 0) {
          lines.push(`<b>Pending Review (${pending.length})</b>`);
          for (const d of pending.slice(0, 5)) {
            const headline = d.topicBrief.headline.slice(0, 50);
            lines.push(`▸ <code>${d.id}</code> [${d.platform}]`);
            lines.push(`  ${headline}`);
          }
          lines.push('');
        }

        if (approved.length > 0) {
          lines.push(`<b>Ready to Publish (${approved.length})</b>`);
          for (const d of approved.slice(0, 5)) {
            const headline = d.topicBrief.headline.slice(0, 50);
            lines.push(`▸ <code>${d.id}</code> [${d.platform}]`);
            lines.push(`  ${headline}`);
          }
          lines.push('');
        }

        lines.push('Commands: /content approve &lt;id&gt; | reject &lt;id&gt; | preview &lt;id&gt; | publish &lt;id&gt;');
        await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
        break;
      }

      case 'preview': {
        const draftId = args[1];
        if (!draftId) {
          await ctx.reply('Usage: /content preview &lt;draft-id&gt;', { parse_mode: 'HTML' });
          return;
        }

        const draft = plugin.getDraftQueue().getDraft(draftId);
        if (!draft) {
          await ctx.reply(`Draft not found: ${draftId}`);
          return;
        }

        const lines: string[] = [
          `<b>Draft Preview</b>`,
          `ID: <code>${draft.id}</code>`,
          `Platform: ${draft.platform}`,
          `Status: ${draft.status}`,
          `Topic: ${draft.topicBrief.headline}`,
          `Angle: ${draft.topicBrief.angle}`,
          '',
          '<b>Content:</b>',
        ];

        for (let i = 0; i < draft.content.length; i++) {
          if (draft.content.length > 1) {
            lines.push(`<b>[${i + 1}/${draft.content.length}]</b>`);
          }
          lines.push(draft.content[i]);
          if (i < draft.content.length - 1) lines.push('');
        }

        await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
        break;
      }

      case 'approve': {
        const draftId = args[1];
        if (!draftId) {
          await ctx.reply('Usage: /content approve &lt;draft-id&gt;', { parse_mode: 'HTML' });
          return;
        }

        const draft = plugin.getDraftQueue().getDraft(draftId);
        if (!draft) {
          await ctx.reply(`Draft not found: ${draftId}`);
          return;
        }
        if (draft.status !== 'pending' && draft.status !== 'sent_for_review') {
          await ctx.reply(`Cannot approve draft in "${draft.status}" status.`);
          return;
        }

        await plugin.getDraftQueue().updateStatus(draftId, 'approved');
        await ctx.reply(`Draft <code>${draftId}</code> approved. Use /content publish ${draftId} to post.`, { parse_mode: 'HTML' });
        break;
      }

      case 'reject': {
        const draftId = args[1];
        const reason = args.slice(2).join(' ') || 'Rejected by user';
        if (!draftId) {
          await ctx.reply('Usage: /content reject &lt;draft-id&gt; [reason]', { parse_mode: 'HTML' });
          return;
        }

        const draft = plugin.getDraftQueue().getDraft(draftId);
        if (!draft) {
          await ctx.reply(`Draft not found: ${draftId}`);
          return;
        }

        await plugin.getDraftQueue().updateStatus(draftId, 'rejected', reason);
        await ctx.reply(`Draft <code>${draftId}</code> rejected: ${reason}`, { parse_mode: 'HTML' });
        break;
      }

      case 'publish': {
        const draftId = args[1];
        if (!draftId) {
          await ctx.reply('Usage: /content publish &lt;draft-id&gt;', { parse_mode: 'HTML' });
          return;
        }

        const publisher = plugin.getPublisher();
        if (!publisher) {
          await ctx.reply('Publisher not initialized. X API credentials may be missing.');
          return;
        }

        const result = await publisher.publishDraft(draftId);
        if (result.success) {
          await ctx.reply(
            `Published <code>${draftId}</code>\nTweet IDs: ${result.publishedIds.join(', ')}`,
            { parse_mode: 'HTML' },
          );
        } else {
          await ctx.reply(`Publish failed: ${result.error}`);
        }
        break;
      }

      case 'publishall': {
        const publisher = plugin.getPublisher();
        if (!publisher) {
          await ctx.reply('Publisher not initialized.');
          return;
        }

        const result = await publisher.publishAllApproved();
        await ctx.reply(`Published: ${result.published}, Failed: ${result.failed}`);
        break;
      }

      default:
        await ctx.reply(
          '<b>Content Commands</b>\n\n' +
          '/content drafts — View draft queue\n' +
          '/content preview &lt;id&gt; — Preview a draft\n' +
          '/content approve &lt;id&gt; — Approve for publishing\n' +
          '/content reject &lt;id&gt; [reason] — Reject a draft\n' +
          '/content publish &lt;id&gt; — Publish an approved draft\n' +
          '/content publishall — Publish all approved',
          { parse_mode: 'HTML' },
        );
    }
  } catch (error) {
    await ctx.reply(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
