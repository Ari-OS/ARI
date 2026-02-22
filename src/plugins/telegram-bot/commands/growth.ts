import type { Context } from 'grammy';
import type { PluginRegistry } from '../../../plugins/registry.js';

// ═══════════════════════════════════════════════════════════════════════════════
// /growth — Growth Pod Dashboard & Morning Digest
// ═══════════════════════════════════════════════════════════════════════════════

export async function handleGrowth(
  ctx: Context,
  _registry: PluginRegistry | null,
): Promise<void> {
  const text = ctx.message?.text ?? '';
  const subcommand = text.replace(/^\/growth\s*/i, '').trim().toLowerCase();

  try {
    if (subcommand === 'digest' || subcommand === 'morning') {
      const { InlineKeyboard } = await import('grammy');
      
      const keyboard = new InlineKeyboard()
        .text('✅ Approve All Outreach', 'growth_action_approve_all')
        .text('📊 View Pipeline', 'growth_action_pipeline');

      await ctx.reply(
        '<b>🌅 Pryceless Solutions — Morning Digest</b>\n\n' +
        '<b>Lead Generation (Southern IN):</b>\n' +
        '• <b>12</b> New Legacy Tech Targets Found (Wix/WP4)\n' +
        '• <b>3</b> High-Pain Intent Signals\n\n' +
        '<b>CRM Activity:</b>\n' +
        '• <b>2</b> New Inbound Replies (Awaiting Review)\n' +
        '• <b>1</b> Discovery Call Booked Today\n\n' +
        '<i>Review pending outreach approvals below:</i>',
        { 
          parse_mode: 'HTML',
          reply_markup: keyboard
        }
      );
      return;
    }

    if (subcommand === 'replies') {
      const { InlineKeyboard } = await import('grammy');
      
      const keyboard = new InlineKeyboard()
        .text('✅ Send Suggested', 'growth_reply_send')
        .text('✏️ Edit', 'growth_reply_edit')
        .text('🛑 Reject', 'growth_reply_reject');

      await ctx.reply(
        '<b>💬 Pending CRM Reply</b>\n\n' +
        '<b>From:</b> Southern IN Manufacturing\n' +
        '<b>Message:</b> "Yes, we are looking to update our site. Do you have time next week?"\n\n' +
        '<b>🤖 Claude Opus Suggestion:</b>\n' +
        '<i>"Thanks for getting back to me! Here is my Calendly link to secure a discovery call: https://calendly.com/prycehedrick"</i>',
        { 
          parse_mode: 'HTML',
          reply_markup: keyboard
        }
      );
      return;
    }

    // Default: Growth Pod Dashboard
    const { InlineKeyboard } = await import('grammy');
      
    const keyboard = new InlineKeyboard()
      .text('🌅 Morning Digest', 'cmd_growth_digest')
      .text('💬 View Replies', 'cmd_growth_replies');

    await ctx.reply(
      '<b>📈 Growth Pod — Command Center</b>\n\n' +
      '<b>Active Pipelines:</b>\n' +
      '• Southern IN Legacy Tech (Apollo/Clay)\n' +
      '• Smartlead Cold Outreach Sequence\n\n' +
      '<b>Options:</b>\n' +
      '• /growth digest — View Morning Digest\n' +
      '• /growth replies — Manage CRM Replies',
      { 
        parse_mode: 'HTML',
        reply_markup: keyboard
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await ctx.reply(`Error: ${message}`);
  }
}
