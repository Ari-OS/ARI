/**
 * ARI Audit Reporter
 *
 * Generates beautiful, actionable audit reports.
 * Designed for quick scanning with clear insights.
 */

import { dailyAudit, DailyAudit } from './daily-audit.js';
import { notificationManager } from './notification-manager.js';

// ─── Report Formatting ───────────────────────────────────────────────────────

/**
 * Generate a formatted daily report for Pushover
 */
export async function generateDailyReport(): Promise<string> {
  const audit = await dailyAudit.getTodayAudit();
  const efficiency = dailyAudit.getEfficiencyMetrics();
  const historical = await dailyAudit.getHistoricalEfficiency(7);

  const lines: string[] = [];

  // ── Header ──
  lines.push(`◈ ARI Daily Report`);
  lines.push(`${audit.date}`);
  lines.push('─'.repeat(24));
  lines.push('');

  // ── Stats Overview ──
  const successRate = audit.summary.totalActivities > 0
    ? Math.round((audit.summary.successful / audit.summary.totalActivities) * 100)
    : 100;

  lines.push('ACTIVITY');
  lines.push(`  ✓ ${audit.summary.tasksCompleted} completed`);
  lines.push(`  ✗ ${audit.summary.failed} failed`);
  lines.push(`  ○ ${successRate}% success rate`);
  lines.push('');

  // ── Cost ──
  lines.push('COST');
  lines.push(`  ◈ $${audit.summary.estimatedCost.toFixed(2)} today`);
  lines.push(`  ◈ ${formatTokens(audit.summary.tokensUsed)} tokens`);
  if (audit.summary.claudeMaxMinutes > 0) {
    const hours = (audit.summary.claudeMaxMinutes / 60).toFixed(1);
    lines.push(`  ◈ ${hours}hr Claude Max`);
  }
  lines.push('');

  // ── Efficiency ──
  const trend = historical.trend === 'improving' ? '↑' :
                historical.trend === 'declining' ? '↓' : '→';

  lines.push('EFFICIENCY');
  lines.push(`  ${trend} ${efficiency.tasksPerApiDollar.toFixed(1)} tasks/$`);
  if (efficiency.avgTokensPerTask > 0) {
    lines.push(`  ○ ${Math.round(efficiency.avgTokensPerTask)} tokens/task avg`);
  }
  lines.push(`  ◇ Preferred: ${efficiency.preferredWorkType}`);
  lines.push('');

  // ── Highlights ──
  if (audit.highlights.length > 0) {
    lines.push('HIGHLIGHTS');
    audit.highlights.forEach(h => {
      lines.push(`  ▸ ${h}`);
    });
    lines.push('');
  }

  // ── Issues ──
  if (audit.issues.length > 0) {
    lines.push('ISSUES');
    audit.issues.forEach(i => {
      lines.push(`  ⚠ ${i}`);
    });
    lines.push('');
  }

  // ── Recommendations ──
  if (audit.recommendations.length > 0) {
    lines.push('RECOMMENDATIONS');
    audit.recommendations.forEach(r => {
      lines.push(`  → ${r}`);
    });
    lines.push('');
  }

  // ── Footer ──
  lines.push('─'.repeat(24));
  lines.push(`Generated ${new Date().toLocaleTimeString()}`);

  return lines.join('\n');
}

/**
 * Generate executive summary (very short)
 */
export async function generateExecutiveSummary(): Promise<string> {
  const audit = await dailyAudit.getTodayAudit();
  const efficiency = dailyAudit.getEfficiencyMetrics();
  const historical = await dailyAudit.getHistoricalEfficiency(7);

  const trend = historical.trend === 'improving' ? '↑' :
                historical.trend === 'declining' ? '↓' : '→';

  const lines: string[] = [];

  // One-line stats with efficiency
  const efficiencyStr = efficiency.tasksPerApiDollar > 0
    ? ` ${efficiency.tasksPerApiDollar.toFixed(1)}t/$`
    : '';
  lines.push(`✓${audit.summary.tasksCompleted} ✗${audit.summary.failed} ◈$${audit.summary.estimatedCost.toFixed(2)}${efficiencyStr} ${trend}`);

  // Key insight (if any)
  if (audit.issues.length > 0) {
    lines.push(`⚠ ${audit.issues[0]}`);
  } else if (audit.highlights.length > 0) {
    lines.push(`▸ ${audit.highlights[0]}`);
  }

  return lines.join('\n');
}

/**
 * Check if daily report should be sent
 */
export function shouldSendDailyReport(): boolean {
  const now = new Date();
  const hour = now.getHours();

  // Send at 8am or 9pm
  return hour === 8 || hour === 21;
}

/**
 * Send the daily report if conditions are met
 */
export async function maybeSendDailyReport(): Promise<boolean> {
  if (!shouldSendDailyReport()) return false;

  const audit = await dailyAudit.getTodayAudit();
  const efficiency = dailyAudit.getEfficiencyMetrics();
  const historical = await dailyAudit.getHistoricalEfficiency(7);

  await notificationManager.dailySummary({
    tasksCompleted: audit.summary.tasksCompleted,
    tasksFailed: audit.summary.failed,
    estimatedCost: audit.summary.estimatedCost,
    highlights: audit.highlights,
    issues: audit.issues,
    efficiency: {
      tasksPerApiDollar: efficiency.tasksPerApiDollar,
      trend: historical.trend,
    },
  });

  return true;
}

/**
 * Generate weekly summary
 */
export async function generateWeeklySummary(): Promise<string> {
  const historical = await dailyAudit.getHistoricalEfficiency(7);
  const audits: DailyAudit[] = [];

  // Gather last 7 days
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const audit = await dailyAudit.getAudit(dateStr);
    if (audit) audits.push(audit);
  }

  const totalTasks = audits.reduce((sum, a) => sum + a.summary.tasksCompleted, 0);
  const totalCost = audits.reduce((sum, a) => sum + a.summary.estimatedCost, 0);
  const totalFailed = audits.reduce((sum, a) => sum + a.summary.failed, 0);

  const lines: string[] = [];

  lines.push('◈ Weekly Summary');
  lines.push('─'.repeat(24));
  lines.push('');
  lines.push(`  ✓ ${totalTasks} tasks completed`);
  lines.push(`  ✗ ${totalFailed} failed`);
  lines.push(`  ◈ $${totalCost.toFixed(2)} total cost`);
  lines.push('');

  const trend = historical.trend === 'improving' ? '↑ Improving' :
                historical.trend === 'declining' ? '↓ Declining' : '→ Stable';
  lines.push(`Efficiency: ${trend}`);
  lines.push(`  ${historical.avgTasksPerApiDollar.toFixed(1)} tasks/$ avg`);

  return lines.join('\n');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return tokens.toString();
}

// ─── Threshold Monitoring ────────────────────────────────────────────────────

interface ThresholdCheck {
  id: string;
  name: string;
  check: () => Promise<{ triggered: boolean; value: number; message: string }>;
  cooldownMinutes: number;
  lastTriggered?: number;
}

const thresholds: ThresholdCheck[] = [
  {
    id: 'daily_cost_75',
    name: 'Budget 75%',
    cooldownMinutes: 120,
    check: async () => {
      const audit = await dailyAudit.getTodayAudit();
      const dailyBudget = 9; // $9/day
      const percent = (audit.summary.estimatedCost / dailyBudget) * 100;
      return {
        triggered: percent >= 75,
        value: percent,
        message: `Daily spend at ${percent.toFixed(0)}% ($${audit.summary.estimatedCost.toFixed(2)}/$${dailyBudget})`,
      };
    },
  },
  {
    id: 'daily_cost_90',
    name: 'Budget 90%',
    cooldownMinutes: 60,
    check: async () => {
      const audit = await dailyAudit.getTodayAudit();
      const dailyBudget = 9;
      const percent = (audit.summary.estimatedCost / dailyBudget) * 100;
      return {
        triggered: percent >= 90,
        value: percent,
        message: `Daily spend at ${percent.toFixed(0)}% - approaching limit`,
      };
    },
  },
  {
    id: 'error_spike',
    name: 'Error Spike',
    cooldownMinutes: 30,
    check: async () => {
      const audit = await dailyAudit.getTodayAudit();
      const errorRate = audit.summary.totalActivities > 0
        ? audit.summary.failed / audit.summary.totalActivities
        : 0;
      return {
        triggered: errorRate >= 0.2 && audit.summary.failed >= 3,
        value: errorRate * 100,
        message: `Error rate at ${(errorRate * 100).toFixed(0)}% (${audit.summary.failed} failures)`,
      };
    },
  },
  {
    id: 'efficiency_drop',
    name: 'Efficiency Drop',
    cooldownMinutes: 240,
    check: async () => {
      const historical = await dailyAudit.getHistoricalEfficiency(7);
      return {
        triggered: historical.trend === 'declining',
        value: historical.avgTasksPerApiDollar,
        message: 'Efficiency trending down - consider reviewing task patterns',
      };
    },
  },
];

/**
 * Check all thresholds and notify if needed
 */
export async function checkThresholds(): Promise<void> {
  const now = Date.now();

  for (const threshold of thresholds) {
    // Check cooldown
    if (threshold.lastTriggered) {
      const cooldownMs = threshold.cooldownMinutes * 60 * 1000;
      if (now - threshold.lastTriggered < cooldownMs) continue;
    }

    const result = await threshold.check();

    if (result.triggered) {
      threshold.lastTriggered = now;

      // Determine priority based on threshold
      const isUrgent = threshold.id.includes('90') || threshold.id === 'error_spike';

      if (isUrgent) {
        await notificationManager.notify({
          category: 'system',
          title: threshold.name,
          body: result.message,
          priority: 'high',
        });
      } else {
        await notificationManager.notify({
          category: 'system',
          title: threshold.name,
          body: result.message,
          priority: 'normal',
        });
      }
    }
  }
}

// ─── Export ──────────────────────────────────────────────────────────────────

export const auditReporter = {
  generateDailyReport,
  generateExecutiveSummary,
  generateWeeklySummary,
  shouldSendDailyReport,
  maybeSendDailyReport,
  checkThresholds,
};
