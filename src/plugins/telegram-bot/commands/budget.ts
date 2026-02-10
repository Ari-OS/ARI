import type { Context } from 'grammy';
import type { CostTracker } from '../../../observability/cost-tracker.js';

// ═══════════════════════════════════════════════════════════════════════════════
// /budget — Budget/cost overview
// ═══════════════════════════════════════════════════════════════════════════════

export async function handleBudget(
  ctx: Context,
  costTracker: CostTracker | null,
): Promise<void> {
  if (!costTracker) {
    await ctx.reply('Cost tracker not available.');
    return;
  }

  try {
    const budget = costTracker.getBudget();
    const utilization = costTracker.getBudgetUtilization();

    const lines = [
      '<b>Budget Status</b>',
      '',
      `📊 Daily: ${utilization.daily.toFixed(1)}% of $${budget.daily.toFixed(2)}`,
      `📊 Weekly: ${utilization.weekly.toFixed(1)}% of $${budget.weekly.toFixed(2)}`,
      `📊 Monthly: ${utilization.monthly.toFixed(1)}% of $${budget.monthly.toFixed(2)}`,
    ];

    await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
  } catch (error) {
    await ctx.reply(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
