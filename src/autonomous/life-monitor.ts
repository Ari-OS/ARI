/**
 * ARI Life Monitor
 *
 * Proactive monitoring system that aggregates "things Pryce needs to act on"
 * from all ARI subsystems into actionable alerts. This is the missing bridge
 * between ARI's many monitoring systems and Pryce's attention.
 *
 * Monitors:
 * 1. API Credit Balances — checks Anthropic/OpenAI/Google actual balances
 * 2. Subscription Renewals — tracks renewal dates for paid services
 * 3. System Resources — disk space, daemon uptime, error rates
 * 4. Budget Health — daily/weekly spend vs limits
 * 5. Stale Work — PRs, tasks, or projects that need attention
 * 6. Career Pulse — days since portfolio update, skill practice
 * 7. ARI Self-Health — last successful briefing, scan errors, test failures
 *
 * Each monitor returns MonitorAlert[] which get:
 * - Included in morning briefings (daily)
 * - Sent as urgent Telegram if critical
 * - Aggregated into weekly action summaries
 *
 * Architecture: Layer 5 (Execution) — imports from L0-L4
 */

import { EventBus } from '../kernel/event-bus.js';
import { createLogger } from '../kernel/logger.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';

const log = createLogger('life-monitor');

const ARI_DIR = path.join(homedir(), '.ari');
const MONITOR_STATE_PATH = path.join(ARI_DIR, 'life-monitor-state.json');
const SUBSCRIPTIONS_PATH = path.join(ARI_DIR, 'subscriptions.json');

// ─── Types ───────────────────────────────────────────────────────────────────

export type AlertSeverity = 'info' | 'warning' | 'urgent' | 'critical';
export type AlertCategory =
  | 'api_credits'
  | 'subscription'
  | 'system'
  | 'budget'
  | 'stale_work'
  | 'career'
  | 'ari_health';

export interface MonitorAlert {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  description: string;
  actionRequired: string;
  deadline?: string; // ISO date — when this becomes critical
  data?: Record<string, unknown>;
  createdAt: string;
}

export interface Subscription {
  name: string;
  cost: number; // monthly
  renewalDay: number; // day of month (1-31)
  cancelUrl?: string;
  notes?: string;
  active: boolean;
}

interface MonitorState {
  lastRun: string;
  lastAlerts: MonitorAlert[];
  suppressedAlertIds: string[]; // User dismissed
  subscriptions: Subscription[];
}

export interface LifeMonitorReport {
  generatedAt: string;
  alerts: MonitorAlert[];
  summary: string;
  telegramHtml: string;
  criticalCount: number;
  urgentCount: number;
  warningCount: number;
  infoCount: number;
}

// ─── Default Subscriptions (Pryce's known services) ─────────────────────────

const DEFAULT_SUBSCRIPTIONS: Subscription[] = [
  { name: 'Claude Max 20x', cost: 200, renewalDay: 1, active: true, notes: 'Primary AI tool' },
  { name: 'ChatGPT Plus', cost: 20, renewalDay: 1, active: true },
  { name: 'Gemini Pro', cost: 20, renewalDay: 1, active: true },
  { name: 'Grok Super', cost: 30, renewalDay: 1, active: false, notes: 'Expired March 2026' },
];

// ─── Safe Command Execution ─────────────────────────────────────────────────

function safeExec(command: string, args: string[]): string {
  try {
    return execFileSync(command, args, {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '';
  }
}

// ─── Life Monitor ────────────────────────────────────────────────────────────

export class LifeMonitor {
  private eventBus: EventBus;
  private state: MonitorState;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.state = {
      lastRun: '',
      lastAlerts: [],
      suppressedAlertIds: [],
      subscriptions: DEFAULT_SUBSCRIPTIONS,
    };
  }

  async init(): Promise<void> {
    await this.loadState();
    await this.loadSubscriptions();
    log.info('Life monitor initialized');
  }

  /**
   * Run all monitors and return a unified report
   */
  async scan(): Promise<LifeMonitorReport> {
    const alerts: MonitorAlert[] = [];

    // Run all monitors in parallel
    const results = await Promise.allSettled([
      this.checkApiCredits(),
      this.checkSubscriptions(),
      this.checkSystemResources(),
      this.checkBudgetHealth(),
      this.checkStaleWork(),
      this.checkAriHealth(),
    ]);

    for (const result of results) {
      if (result.status === 'fulfilled') {
        alerts.push(...result.value);
      } else {
        log.warn({ error: result.reason as unknown }, 'Monitor check failed');
      }
    }

    // Filter out suppressed alerts
    const activeAlerts = alerts.filter(
      (a) => !this.state.suppressedAlertIds.includes(a.id)
    );

    // Sort by severity (critical first)
    const severityOrder: Record<AlertSeverity, number> = {
      critical: 0,
      urgent: 1,
      warning: 2,
      info: 3,
    };
    activeAlerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    const report: LifeMonitorReport = {
      generatedAt: new Date().toISOString(),
      alerts: activeAlerts,
      summary: this.buildSummary(activeAlerts),
      telegramHtml: this.formatTelegramHtml(activeAlerts),
      criticalCount: activeAlerts.filter((a) => a.severity === 'critical').length,
      urgentCount: activeAlerts.filter((a) => a.severity === 'urgent').length,
      warningCount: activeAlerts.filter((a) => a.severity === 'warning').length,
      infoCount: activeAlerts.filter((a) => a.severity === 'info').length,
    };

    // Save state
    this.state.lastRun = report.generatedAt;
    this.state.lastAlerts = activeAlerts;
    await this.saveState();

    // Emit event
    this.eventBus.emit('life_monitor:scan_complete', {
      alerts: activeAlerts.length,
      critical: report.criticalCount,
      urgent: report.urgentCount,
    });

    log.info({
      total: activeAlerts.length,
      critical: report.criticalCount,
      urgent: report.urgentCount,
    }, 'Life monitor scan complete');

    return report;
  }

  // ─── Monitor: API Credits ──────────────────────────────────────────────────

  private async checkApiCredits(): Promise<MonitorAlert[]> {
    const alerts: MonitorAlert[] = [];

    // Check Anthropic API balance
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'hi' }],
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (response.status === 401) {
          alerts.push({
            id: 'api_anthropic_invalid',
            category: 'api_credits',
            severity: 'critical',
            title: 'Anthropic API Key Invalid',
            description: 'Your Anthropic API key is rejected. ARI cannot use Claude models.',
            actionRequired: 'Go to console.anthropic.com and generate a new key, then update ~/.ari/.env',
            createdAt: new Date().toISOString(),
          });
        } else if (response.status === 429) {
          alerts.push({
            id: 'api_anthropic_rate_limit',
            category: 'api_credits',
            severity: 'warning',
            title: 'Anthropic Rate Limited',
            description: 'Anthropic API is rate limiting requests. May indicate low credits.',
            actionRequired: 'Check credits at console.anthropic.com/settings/billing',
            createdAt: new Date().toISOString(),
          });
        } else if (response.status === 400) {
          // 400 with "billing" or "credit" in body = no credits
          const body = await response.text();
          if (body.includes('credit') || body.includes('billing') || body.includes('exceeded')) {
            alerts.push({
              id: 'api_anthropic_no_credits',
              category: 'api_credits',
              severity: 'urgent',
              title: 'Anthropic API Credits Depleted',
              description: 'No API credits remaining. ARI cascades to free models but loses Claude quality.',
              actionRequired: 'Add $5+ credits at console.anthropic.com/settings/billing',
              deadline: new Date().toISOString(), // Immediate
              createdAt: new Date().toISOString(),
            });
          }
        }
        // Status 200 = working fine, no alert needed
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        if (!msg.includes('timeout') && !msg.includes('abort')) {
          alerts.push({
            id: 'api_anthropic_unreachable',
            category: 'api_credits',
            severity: 'warning',
            title: 'Anthropic API Unreachable',
            description: `Cannot reach Anthropic API: ${msg.slice(0, 100)}`,
            actionRequired: 'Check network connectivity',
            createdAt: new Date().toISOString(),
          });
        }
      }
    } else {
      alerts.push({
        id: 'api_anthropic_missing',
        category: 'api_credits',
        severity: 'urgent',
        title: 'Anthropic API Key Not Set',
        description: 'ANTHROPIC_API_KEY is not in ~/.ari/.env. ARI cannot use Claude models.',
        actionRequired: 'Get an API key from console.anthropic.com and add to ~/.ari/.env',
        createdAt: new Date().toISOString(),
      });
    }

    // Check OpenAI
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      try {
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${openaiKey}` },
          signal: AbortSignal.timeout(10000),
        });
        if (response.status === 401) {
          alerts.push({
            id: 'api_openai_invalid',
            category: 'api_credits',
            severity: 'warning',
            title: 'OpenAI API Key Invalid',
            description: 'OpenAI key rejected. Fallback models unavailable.',
            actionRequired: 'Regenerate at platform.openai.com/api-keys',
            createdAt: new Date().toISOString(),
          });
        }
      } catch {
        // Network issues are non-critical for OpenAI (it's a fallback)
      }
    }

    return alerts;
  }

  // ─── Monitor: Subscriptions ────────────────────────────────────────────────

  private async checkSubscriptions(): Promise<MonitorAlert[]> {
    const alerts: MonitorAlert[] = [];
    const now = new Date();
    const currentDay = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    for (const sub of this.state.subscriptions) {
      if (!sub.active) continue;

      // Calculate days until renewal
      let daysUntilRenewal: number;
      if (sub.renewalDay > currentDay) {
        daysUntilRenewal = sub.renewalDay - currentDay;
      } else if (sub.renewalDay === currentDay) {
        daysUntilRenewal = 0;
      } else {
        daysUntilRenewal = daysInMonth - currentDay + sub.renewalDay;
      }

      // Alert 3 days before renewal
      if (daysUntilRenewal <= 3 && daysUntilRenewal > 0) {
        alerts.push({
          id: `sub_renewal_${sub.name.toLowerCase().replace(/\s+/g, '_')}`,
          category: 'subscription',
          severity: sub.cost >= 50 ? 'warning' : 'info',
          title: `${sub.name} Renews in ${daysUntilRenewal} Day${daysUntilRenewal > 1 ? 's' : ''}`,
          description: `$${sub.cost}/mo will be charged on the ${sub.renewalDay}th.${sub.notes ? ` Note: ${sub.notes}` : ''}`,
          actionRequired: daysUntilRenewal === 1
            ? `Review if you still need ${sub.name}. Cancel before tomorrow if not.`
            : `Ensure payment method is current for ${sub.name}.`,
          deadline: new Date(now.getFullYear(), now.getMonth(), sub.renewalDay).toISOString(),
          data: { cost: sub.cost, service: sub.name },
          createdAt: new Date().toISOString(),
        });
      }

      // Alert on renewal day
      if (daysUntilRenewal === 0) {
        alerts.push({
          id: `sub_charged_${sub.name.toLowerCase().replace(/\s+/g, '_')}`,
          category: 'subscription',
          severity: 'info',
          title: `${sub.name} Renewed Today`,
          description: `$${sub.cost} charged for ${sub.name}.`,
          actionRequired: 'No action needed. Just an FYI.',
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Calculate total monthly subscription cost
    const totalMonthly = this.state.subscriptions
      .filter((s) => s.active)
      .reduce((sum, s) => sum + s.cost, 0);

    if (totalMonthly > 300) {
      alerts.push({
        id: 'sub_total_high',
        category: 'subscription',
        severity: 'warning',
        title: `Total Subscriptions: $${totalMonthly}/mo`,
        description: `You're spending $${totalMonthly}/month on AI subscriptions. Consider consolidating.`,
        actionRequired: 'Review which services provide unique value vs overlap.',
        createdAt: new Date().toISOString(),
      });
    }

    return Promise.resolve(alerts);
  }

  // ─── Monitor: System Resources ─────────────────────────────────────────────

  private checkSystemResources(): Promise<MonitorAlert[]> {
    const alerts: MonitorAlert[] = [];

    // Check disk space using execFileSync (safe, no shell injection)
    const dfOutput = safeExec('df', ['-h', '/']);
    if (dfOutput) {
      const lastLine = dfOutput.split('\n').pop() ?? '';
      const parts = lastLine.trim().split(/\s+/);
      const usedPercent = parseInt(parts[4]?.replace('%', '') ?? '0', 10);

      if (usedPercent >= 90) {
        alerts.push({
          id: 'sys_disk_critical',
          category: 'system',
          severity: 'critical',
          title: `Disk ${usedPercent}% Full`,
          description: `Root disk is ${usedPercent}% full. ARI data writes may fail.`,
          actionRequired: 'Free disk space immediately. Check ~/.ari/knowledge/ and logs.',
          createdAt: new Date().toISOString(),
        });
      } else if (usedPercent >= 80) {
        alerts.push({
          id: 'sys_disk_warning',
          category: 'system',
          severity: 'warning',
          title: `Disk ${usedPercent}% Full`,
          description: `Root disk usage is ${usedPercent}%. Consider cleanup.`,
          actionRequired: 'Run cleanup: clear old digests, logs, and build artifacts.',
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Check if daemon is running (look for the launchd plist being loaded)
    const launchctlOutput = safeExec('launchctl', ['list']);
    if (launchctlOutput && !launchctlOutput.includes('com.ari.gateway')) {
      alerts.push({
        id: 'sys_daemon_down',
        category: 'system',
        severity: 'urgent',
        title: 'ARI Daemon Not Running',
        description: 'The ARI gateway daemon is not running. Scheduled tasks are not executing.',
        actionRequired: 'Run: npx ari daemon install --production',
        createdAt: new Date().toISOString(),
      });
    }

    // Check ~/.ari directory size
    const duOutput = safeExec('du', ['-sh', ARI_DIR]);
    if (duOutput) {
      const sizeStr = duOutput.split('\t')[0] ?? '';
      const sizeMatch = sizeStr.match(/^([\d.]+)([KMGT])/);
      if (sizeMatch) {
        const value = parseFloat(sizeMatch[1]);
        const unit = sizeMatch[2];
        const sizeGB = unit === 'G' ? value
          : unit === 'T' ? value * 1024
          : unit === 'M' ? value / 1024
          : value / (1024 * 1024);

        if (sizeGB > 5) {
          alerts.push({
            id: 'sys_ari_data_large',
            category: 'system',
            severity: 'info',
            title: `ARI Data Directory: ${sizeStr}`,
            description: 'Consider pruning old digests, backups, and knowledge snapshots.',
            actionRequired: 'Review ~/.ari/knowledge/digests/ and ~/.ari/backups/ for cleanup.',
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    return Promise.resolve(alerts);
  }

  // ─── Monitor: Budget Health ────────────────────────────────────────────────

  private async checkBudgetHealth(): Promise<MonitorAlert[]> {
    const alerts: MonitorAlert[] = [];

    // Read token usage file
    try {
      const usagePath = path.join(ARI_DIR, 'token-usage.json');
      const data = await fs.readFile(usagePath, 'utf-8');
      const usage = JSON.parse(data) as {
        daily?: { totalCost?: number };
        weekly?: { totalCost?: number };
        monthly?: { totalCost?: number };
      };

      const dailyCost = usage.daily?.totalCost ?? 0;
      const weeklyCost = usage.weekly?.totalCost ?? 0;

      // Read budget config
      const budgetPath = path.join(ARI_DIR, 'budget-config.json');
      let dailyLimit = 5;
      let weeklyLimit = 25;
      try {
        const budgetData = await fs.readFile(budgetPath, 'utf-8');
        const budget = JSON.parse(budgetData) as { daily?: number; weekly?: number };
        dailyLimit = budget.daily ?? 5;
        weeklyLimit = budget.weekly ?? 25;
      } catch {
        // Use defaults
      }

      const dailyPercent = (dailyCost / dailyLimit) * 100;
      const weeklyPercent = (weeklyCost / weeklyLimit) * 100;

      if (dailyPercent >= 90) {
        alerts.push({
          id: 'budget_daily_critical',
          category: 'budget',
          severity: 'urgent',
          title: `Daily Budget ${dailyPercent.toFixed(0)}% Used`,
          description: `$${dailyCost.toFixed(2)} of $${dailyLimit} daily budget consumed. ARI autonomous work may be paused.`,
          actionRequired: 'Budget resets at midnight. Consider pausing non-essential operations.',
          createdAt: new Date().toISOString(),
        });
      } else if (dailyPercent >= 75) {
        alerts.push({
          id: 'budget_daily_warning',
          category: 'budget',
          severity: 'warning',
          title: `Daily Budget ${dailyPercent.toFixed(0)}% Used`,
          description: `$${dailyCost.toFixed(2)} of $${dailyLimit} spent today.`,
          actionRequired: 'Monitor spending. Consider using cheaper models for remaining tasks.',
          createdAt: new Date().toISOString(),
        });
      }

      if (weeklyPercent >= 80) {
        alerts.push({
          id: 'budget_weekly_warning',
          category: 'budget',
          severity: 'warning',
          title: `Weekly Budget ${weeklyPercent.toFixed(0)}% Used`,
          description: `$${weeklyCost.toFixed(2)} of $${weeklyLimit} weekly budget consumed.`,
          actionRequired: 'Review cost breakdown. Are expensive models being used efficiently?',
          createdAt: new Date().toISOString(),
        });
      }
    } catch {
      // No usage data yet — that's fine
    }

    return alerts;
  }

  // ─── Monitor: Stale Work ───────────────────────────────────────────────────

  private async checkStaleWork(): Promise<MonitorAlert[]> {
    const alerts: MonitorAlert[] = [];

    // Check for uncommitted git changes in ARI repo
    const statusOutput = safeExec('git', ['status', '--porcelain']);
    if (statusOutput) {
      const uncommitted = statusOutput.split('\n').filter((l) => l.trim()).length;

      if (uncommitted > 10) {
        alerts.push({
          id: 'stale_uncommitted_changes',
          category: 'stale_work',
          severity: 'info',
          title: `${uncommitted} Uncommitted Files in ARI`,
          description: 'Large number of uncommitted changes. Consider committing or cleaning up.',
          actionRequired: 'Run git status to review, then commit or discard.',
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Check for stale scheduler state (tasks that haven't run in 2+ days)
    try {
      const schedulerPath = path.join(ARI_DIR, 'scheduler-state.json');
      const data = await fs.readFile(schedulerPath, 'utf-8');
      const schedulerState = JSON.parse(data) as {
        tasks: Record<string, { lastRun?: string; enabled: boolean }>;
        lastChecked: string;
      };

      const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;

      // Check if scheduler has run recently
      if (new Date(schedulerState.lastChecked).getTime() < twoDaysAgo) {
        alerts.push({
          id: 'stale_scheduler',
          category: 'ari_health',
          severity: 'urgent',
          title: 'Scheduler Not Running',
          description: 'The ARI scheduler has not run in over 2 days. No briefings or scans are executing.',
          actionRequired: 'Check daemon status: npx ari daemon status. Reinstall if needed.',
          createdAt: new Date().toISOString(),
        });
      }

      // Check for essential tasks that haven't run
      const essentialTasks = ['morning-briefing', 'health-check', 'intelligence-scan'];
      for (const taskId of essentialTasks) {
        const task = schedulerState.tasks[taskId];
        if (task?.enabled && task.lastRun) {
          const lastRun = new Date(task.lastRun).getTime();
          if (lastRun < twoDaysAgo) {
            alerts.push({
              id: `stale_task_${taskId}`,
              category: 'ari_health',
              severity: 'warning',
              title: `${taskId} Not Running`,
              description: `Scheduled task "${taskId}" hasn't run in 2+ days.`,
              actionRequired: 'Check daemon logs for errors.',
              createdAt: new Date().toISOString(),
            });
          }
        }
      }
    } catch {
      // No scheduler state yet
    }

    return alerts;
  }

  // ─── Monitor: ARI Self-Health ──────────────────────────────────────────────

  private async checkAriHealth(): Promise<MonitorAlert[]> {
    const alerts: MonitorAlert[] = [];

    // Check last digest delivery
    try {
      const digestDir = path.join(ARI_DIR, 'knowledge', 'digests');
      const files = await fs.readdir(digestDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json')).sort().reverse();

      if (jsonFiles.length === 0) {
        alerts.push({
          id: 'ari_no_digests',
          category: 'ari_health',
          severity: 'info',
          title: 'No Daily Digests Yet',
          description: 'ARI has never generated a daily intel digest. Intelligence scanner may not be running.',
          actionRequired: 'Ensure daemon is running with X_BEARER_TOKEN set in ~/.ari/.env.',
          createdAt: new Date().toISOString(),
        });
      } else {
        // Check if latest digest is stale
        const latestDate = jsonFiles[0].replace('.json', '');
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        if (latestDate !== today && latestDate !== yesterday) {
          alerts.push({
            id: 'ari_stale_digest',
            category: 'ari_health',
            severity: 'warning',
            title: 'Daily Digest Stale',
            description: `Last digest was ${latestDate}. Intelligence scanner may have stopped.`,
            actionRequired: 'Check daemon logs and intelligence scanner configuration.',
            createdAt: new Date().toISOString(),
          });
        }
      }
    } catch {
      // Digest directory doesn't exist yet
    }

    // Check test health (last test run results)
    try {
      const testResultPath = path.join(ARI_DIR, 'last-test-result.json');
      const data = await fs.readFile(testResultPath, 'utf-8');
      const testResult = JSON.parse(data) as {
        passed: number;
        failed: number;
        timestamp: string;
      };

      if (testResult.failed > 0) {
        alerts.push({
          id: 'ari_test_failures',
          category: 'ari_health',
          severity: 'warning',
          title: `${testResult.failed} Test Failures`,
          description: `Last test run: ${testResult.passed} passed, ${testResult.failed} failed.`,
          actionRequired: 'Run npm test to investigate failures.',
          data: { passed: testResult.passed, failed: testResult.failed },
          createdAt: new Date().toISOString(),
        });
      }
    } catch {
      // No test results file — that's normal
    }

    return alerts;
  }

  // ─── Formatting ────────────────────────────────────────────────────────────

  private buildSummary(alerts: MonitorAlert[]): string {
    if (alerts.length === 0) {
      return 'All clear. No action items detected.';
    }

    const critical = alerts.filter((a) => a.severity === 'critical');
    const urgent = alerts.filter((a) => a.severity === 'urgent');
    const warning = alerts.filter((a) => a.severity === 'warning');

    const parts: string[] = [];
    if (critical.length > 0) {
      parts.push(`${critical.length} CRITICAL`);
    }
    if (urgent.length > 0) {
      parts.push(`${urgent.length} urgent`);
    }
    if (warning.length > 0) {
      parts.push(`${warning.length} warning`);
    }

    return `${alerts.length} action items: ${parts.join(', ')}. Top: ${alerts[0].title}`;
  }

  formatTelegramHtml(alerts: MonitorAlert[]): string {
    if (alerts.length === 0) {
      return '<b>◆ Life Monitor</b>\n\nAll clear. No action items.';
    }

    const lines: string[] = [];
    lines.push('<b>◆ ARI LIFE MONITOR</b>');
    lines.push('');

    const severityIcon: Record<AlertSeverity, string> = {
      critical: '🔴',
      urgent: '🟠',
      warning: '🟡',
      info: '🔵',
    };

    // Group by severity
    for (const severity of ['critical', 'urgent', 'warning', 'info'] as AlertSeverity[]) {
      const group = alerts.filter((a) => a.severity === severity);
      if (group.length === 0) continue;

      lines.push(`<b>${severity.toUpperCase()} ALERTS</b>`);

      for (const alert of group) {
        lines.push(`<blockquote>${severityIcon[severity]} <b>${this.escapeHtml(alert.title)}</b>\n${this.escapeHtml(alert.actionRequired)}</blockquote>`);
        if (alert.deadline) {
          const deadline = new Date(alert.deadline);
          const now = new Date();
          const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / 86400000);
          if (daysLeft <= 1) {
            lines.push('<i>Due TODAY</i>');
          } else if (daysLeft <= 3) {
            lines.push(`<i>Due in ${daysLeft} days</i>`);
          }
        }
      }
      lines.push('');
    }

    lines.push(
      `<i>${alerts.length} items · ${new Date().toLocaleString('en-US', { timeZone: 'America/Indiana/Indianapolis', hour: 'numeric', minute: '2-digit' })}</i>`
    );

    return lines.join('\n');
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ─── Subscription Management ───────────────────────────────────────────────

  async addSubscription(sub: Subscription): Promise<void> {
    this.state.subscriptions.push(sub);
    await this.saveSubscriptions();
  }

  async removeSubscription(name: string): Promise<boolean> {
    const idx = this.state.subscriptions.findIndex(
      (s) => s.name.toLowerCase() === name.toLowerCase()
    );
    if (idx === -1) return false;
    this.state.subscriptions.splice(idx, 1);
    await this.saveSubscriptions();
    return true;
  }

  getSubscriptions(): Subscription[] {
    return [...this.state.subscriptions];
  }

  // ─── Alert Suppression ─────────────────────────────────────────────────────

  suppressAlert(alertId: string): void {
    if (!this.state.suppressedAlertIds.includes(alertId)) {
      this.state.suppressedAlertIds.push(alertId);
    }
  }

  unsuppressAlert(alertId: string): void {
    this.state.suppressedAlertIds = this.state.suppressedAlertIds.filter(
      (id) => id !== alertId
    );
  }

  // ─── Persistence ───────────────────────────────────────────────────────────

  private async loadState(): Promise<void> {
    try {
      const data = await fs.readFile(MONITOR_STATE_PATH, 'utf-8');
      const loaded = JSON.parse(data) as Partial<MonitorState>;
      this.state = { ...this.state, ...loaded };
    } catch {
      // Fresh start
    }
  }

  private async saveState(): Promise<void> {
    await fs.mkdir(path.dirname(MONITOR_STATE_PATH), { recursive: true });
    await fs.writeFile(MONITOR_STATE_PATH, JSON.stringify(this.state, null, 2));
  }

  private async loadSubscriptions(): Promise<void> {
    try {
      const data = await fs.readFile(SUBSCRIPTIONS_PATH, 'utf-8');
      const subs = JSON.parse(data) as Subscription[];
      if (subs.length > 0) {
        this.state.subscriptions = subs;
      }
    } catch {
      // Use defaults
    }
  }

  private async saveSubscriptions(): Promise<void> {
    await fs.mkdir(path.dirname(SUBSCRIPTIONS_PATH), { recursive: true });
    await fs.writeFile(
      SUBSCRIPTIONS_PATH,
      JSON.stringify(this.state.subscriptions, null, 2)
    );
  }

  // ─── Status ────────────────────────────────────────────────────────────────

  getStatus(): {
    lastRun: string;
    alertCount: number;
    subscriptionCount: number;
    suppressedCount: number;
  } {
    return {
      lastRun: this.state.lastRun,
      alertCount: this.state.lastAlerts.length,
      subscriptionCount: this.state.subscriptions.filter((s) => s.active).length,
      suppressedCount: this.state.suppressedAlertIds.length,
    };
  }

  getLastAlerts(): MonitorAlert[] {
    return [...this.state.lastAlerts];
  }
}
