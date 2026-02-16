/**
 * ARI Briefings Module
 *
 * Generates unified morning briefings and evening summaries that
 * consolidate intelligence, life monitor alerts, career matches,
 * and audit data into a single scannable Telegram message.
 *
 * Design Principles (Research-Backed):
 * - Inverted pyramid: most important info first
 * - Layer-cake scanning: bold section headers, concise bullets
 * - Max 5 items per section (Miller's Law)
 * - Subtle emoji as structural markers (1 per section header)
 * - Personal tone: warm but competent, never sycophantic
 * - Under 4096 chars for Telegram message limit
 *
 * Morning Briefing (6:30 AM): Unified Telegram message
 * - System health + overnight queue
 * - Intelligence highlights (from daily digest)
 * - Life monitor alerts (subscriptions, deadlines)
 * - Career matches (if any)
 * - Today's priorities
 *
 * Evening Summary (9 PM): Build session prep
 * - Day's accomplishments + changelog
 * - Open issues needing attention
 * - Suggested build tasks for tonight
 * - Career/intelligence updates since morning
 */

import { NotificationManager } from './notification-manager.js';
import { NotionInbox } from '../integrations/notion/inbox.js';
import { dailyAudit, type DailyAudit } from './daily-audit.js';
import { ChangelogGenerator } from './changelog-generator.js';
import { EventBus } from '../kernel/event-bus.js';
import type { NotionConfig } from './types.js';
import type { DailyDigest } from './daily-digest.js';
import type { LifeMonitorReport } from './life-monitor.js';
import type { GovernanceSnapshot } from './governance-reporter.js';

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface BriefingContent {
  type: 'morning' | 'evening' | 'weekly';
  summary: string;
  highlights: string[];
  issues: string[];
  metrics?: Record<string, string | number>;
  actionItems?: string[];
}

export interface BriefingResult {
  success: boolean;
  notionPageId?: string;
  smsSent?: boolean;
  error?: string;
}

export interface BriefingPortfolio {
  totalValue: number;
  dailyChange: number;
  dailyChangePercent: number;
  topGainers: Array<{ asset: string; changePercent: number }>;
  topLosers: Array<{ asset: string; changePercent: number }>;
}

export interface MorningBriefingContext {
  digest?: DailyDigest | null;
  lifeMonitorReport?: LifeMonitorReport | null;
  careerMatches?: Array<{
    title: string;
    company: string;
    matchScore: number;
    remote: boolean;
  }> | null;
  governance?: GovernanceSnapshot | null;
  portfolio?: BriefingPortfolio | null;
  marketAlerts?: Array<{ asset: string; change: string; severity: string }> | null;
}

export interface EveningContext {
  suggestedTasks?: string[];
  careerMatches?: Array<{
    title: string;
    company: string;
    matchScore: number;
  }> | null;
  portfolio?: BriefingPortfolio | null;
}

// ─── Briefing Generator ─────────────────────────────────────────────────────

export class BriefingGenerator {
  private notificationManager: NotificationManager;
  private eventBus: EventBus | null = null;
  private notion: NotionInbox | null = null;
  private changelogGenerator: ChangelogGenerator | null = null;
  private timezone = 'America/Indiana/Indianapolis';

  constructor(notificationManager: NotificationManager, eventBus?: EventBus) {
    this.notificationManager = notificationManager;
    if (eventBus) {
      this.eventBus = eventBus;
      this.changelogGenerator = new ChangelogGenerator(eventBus, process.cwd());
    }
  }

  /**
   * Initialize with Notion config for daily logs
   */
  async initNotion(config: NotionConfig): Promise<boolean> {
    if (!config.enabled || !config.dailyLogParentId) {
      return false;
    }

    this.notion = new NotionInbox(config);
    return await this.notion.init();
  }

  /**
   * Generate and send unified morning briefing
   *
   * Consolidates intelligence digest, life monitor alerts, career matches,
   * and audit data into a single, well-formatted Telegram message.
   */
  async morningBriefing(context?: MorningBriefingContext): Promise<BriefingResult> {
    const now = new Date();
    const dayName = now.toLocaleDateString('en-US', {
      weekday: 'long',
      timeZone: this.timezone,
    });

    // Get yesterday's audit data
    const auditData = await this.getRecentAuditData();

    // Process queued notifications
    const queueResult = await this.notificationManager.processQueue();

    // Build briefing content
    const content: BriefingContent = {
      type: 'morning',
      summary: this.buildMorningSummary(dayName, queueResult, auditData),
      highlights: this.extractHighlights(auditData),
      issues: this.extractIssues(auditData),
      metrics: {
        queuedItems: queueResult.processed,
        yesterdayTasks: auditData?.activities.length ?? 0,
      },
    };

    // Create Notion page if available
    let notionPageId: string | undefined;
    if (this.notion?.isReady()) {
      notionPageId = (await this.notion.createDailyLog({
        summary: content.summary,
        highlights: content.highlights,
        issues: content.issues,
        metrics: content.metrics,
      })) ?? undefined;
    }

    // Build Telegram HTML for unified morning report
    const telegramHtml = this.formatMorningHtml(
      dayName,
      queueResult,
      auditData,
      context,
    );

    // Send via Telegram with pre-formatted HTML
    const smsMessage = this.formatMorningSMS(content, queueResult);
    const smsResult = await this.notificationManager.notify({
      category: 'daily',
      title: `Good morning, ${dayName}`,
      body: smsMessage,
      priority: content.issues.length > 0 ? 'normal' : 'low',
      telegramHtml,
    });

    await dailyAudit.logActivity(
      'system_event',
      'Morning Briefing',
      content.summary,
      {
        outcome: 'success',
        details: {
          type: 'morning',
          notionPageId,
          hasIntelligence: !!(context?.digest),
          hasLifeMonitor: !!(context?.lifeMonitorReport),
          hasCareerMatches: !!(context?.careerMatches?.length),
        },
      }
    );

    // Emit event so value analytics and other systems can track delivery
    this.eventBus?.emit('briefing:morning_delivered', {
      date: now.toISOString().split('T')[0],
    });

    return {
      success: true,
      notionPageId,
      smsSent: smsResult.sent,
    };
  }

  /**
   * Generate and send evening summary for build session prep
   *
   * Includes today's accomplishments, changelog, open issues,
   * and suggested tasks for tonight's build session.
   */
  async eveningSummary(context?: EveningContext): Promise<BriefingResult> {
    const auditData = await this.getRecentAuditData();

    const content: BriefingContent = {
      type: 'evening',
      summary: await this.buildEveningSummary(auditData),
      highlights: this.extractHighlights(auditData),
      issues: this.extractIssues(auditData),
      metrics: this.buildDayMetrics(auditData),
    };

    // Append to Notion daily log if available
    let notionPageId: string | undefined;
    if (this.notion?.isReady()) {
      const todayEntries = await this.notion.getTodayEntries();
      if (todayEntries.length > 0) {
        await this.notion.addNote(
          todayEntries[0].id,
          `\n## Evening Summary\n${content.summary}`
        );
        notionPageId = todayEntries[0].id;
      }
    }

    // Build Telegram HTML for evening message
    const telegramHtml = this.formatEveningHtml(content, auditData, context);

    // Send evening summary via Telegram
    await this.notificationManager.notify({
      category: 'daily',
      title: 'Evening Summary',
      body: this.formatEveningSummary(content),
      priority: 'low',
      telegramHtml,
    });

    await dailyAudit.logActivity(
      'system_event',
      'Evening Summary',
      content.summary,
      {
        outcome: 'success',
        details: { type: 'evening', notionPageId },
      }
    );

    // Emit event for value analytics tracking
    this.eventBus?.emit('briefing:evening_delivered', {
      date: new Date().toISOString().split('T')[0],
    });

    return {
      success: true,
      notionPageId,
      smsSent: false,
    };
  }

  /**
   * Generate and send weekly review
   */
  async weeklyReview(): Promise<BriefingResult> {
    // Get 7 days of audit data
    const weekData = await this.getWeekAuditData();

    const content: BriefingContent = {
      type: 'weekly',
      summary: this.buildWeeklySummary(weekData),
      highlights: this.extractWeeklyHighlights(weekData),
      issues: this.extractWeeklyIssues(weekData),
      metrics: this.buildWeekMetrics(weekData),
      actionItems: this.suggestNextWeekPriorities(weekData),
    };

    // Create dedicated weekly review page
    let notionPageId: string | undefined;
    if (this.notion?.isReady()) {
      notionPageId = (await this.notion.createDailyLog({
        summary: `# Weekly Review\n\n${content.summary}`,
        highlights: content.highlights,
        issues: content.issues,
        metrics: content.metrics,
      })) ?? undefined;
    }

    // Build weekly review HTML
    const telegramHtml = this.formatWeeklyHtml(content, weekData);

    // Send weekly review via Telegram
    await this.notificationManager.notify({
      category: 'daily',
      title: 'Weekly Review',
      body: `${content.summary}\n\n${content.actionItems?.map(a => `- ${a}`).join('\n') ?? ''}`,
      priority: 'normal',
      telegramHtml,
    });

    await dailyAudit.logActivity(
      'system_event',
      'Weekly Review',
      content.summary,
      {
        outcome: 'success',
        details: { type: 'weekly', notionPageId },
      }
    );

    // Emit event for value analytics tracking
    const now = new Date();
    const weekNumber = Math.ceil(
      (now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    this.eventBus?.emit('briefing:weekly_delivered', {
      date: now.toISOString().split('T')[0],
      weekNumber,
    });

    return {
      success: true,
      notionPageId,
      smsSent: false,
    };
  }

  // ─── Telegram HTML Formatters ─────────────────────────────────────────────

  /**
   * Format unified morning briefing as Telegram HTML
   *
   * Structure: greeting → system status → intel → alerts → career → priorities
   * Uses inverted pyramid (most important first) and layer-cake scanning.
   */
  private formatMorningHtml(
    dayName: string,
    queueResult: { processed: number; sent: number },
    auditData: DailyAudit | null,
    context?: MorningBriefingContext,
  ): string {
    const lines: string[] = [];

    // ── Greeting ──
    const greeting = this.getContextualGreeting(dayName);
    lines.push(`<b>${greeting}</b>`);
    const queueNote = queueResult.processed > 0
      ? `${queueResult.processed} items processed overnight`
      : 'Clean overnight';
    const yesterdayCount = auditData?.activities.filter(a => a.outcome === 'success').length ?? 0;
    const yesterdayNote = yesterdayCount > 0 ? ` · ${yesterdayCount} completed yesterday` : '';
    lines.push(`<i>${this.esc(queueNote)}${this.esc(yesterdayNote)}</i>`);
    lines.push('');

    // ── Intelligence Highlights ──
    if (context?.digest && context.digest.sections.length > 0) {
      lines.push('<b>📰 Today\'s Intel</b>');
      const topItems = context.digest.sections
        .flatMap(s => s.items)
        .slice(0, 4);
      for (const item of topItems) {
        const headline = this.esc(item.headline.slice(0, 100));
        if (item.url) {
          lines.push(`▸ <a href="${item.url}">${headline}</a>`);
        } else {
          lines.push(`▸ ${headline}`);
        }
      }
      if (context.digest.stats.itemsIncluded > 4) {
        lines.push(`  <i>${context.digest.stats.itemsIncluded - 4} more in full digest</i>`);
      }
      lines.push('');
    }

    // ── ARI's Take (from digest) ──
    if (context?.digest?.ariTake && context.digest.ariTake.length > 0) {
      lines.push('<b>💡 ARI\'s Take</b>');
      for (const take of context.digest.ariTake.slice(0, 2)) {
        lines.push(`▸ ${this.esc(take.slice(0, 150))}`);
      }
      lines.push('');
    }

    // ── Life Monitor Alerts ──
    if (context?.lifeMonitorReport && context.lifeMonitorReport.alerts.length > 0) {
      const report = context.lifeMonitorReport;
      const alertIcon = report.criticalCount > 0 ? '🔴' : report.urgentCount > 0 ? '⚠' : 'ℹ';
      lines.push(`<b>${alertIcon} Action Items</b>`);
      lines.push(this.esc(report.summary.slice(0, 200)));
      lines.push('');
    }

    // ── Portfolio Snapshot ──
    if (context?.portfolio) {
      const p = context.portfolio;
      const dir = p.dailyChangePercent >= 0 ? '📈' : '📉';
      const sign = p.dailyChangePercent >= 0 ? '+' : '';
      lines.push(`<b>${dir} Portfolio</b>`);
      lines.push(`▸ $${p.totalValue.toLocaleString()} (${sign}${p.dailyChangePercent.toFixed(1)}% today)`);
      if (p.topGainers.length > 0) {
        const top = p.topGainers[0];
        lines.push(`▸ Top: ${this.esc(top.asset)} +${top.changePercent.toFixed(1)}%`);
      }
      if (p.topLosers.length > 0) {
        const worst = p.topLosers[0];
        lines.push(`▸ Dip: ${this.esc(worst.asset)} ${worst.changePercent.toFixed(1)}%`);
      }
      lines.push('');
    }

    // ── Market Alerts ──
    if (context?.marketAlerts && context.marketAlerts.length > 0) {
      lines.push('<b>🔔 Market Alerts</b>');
      for (const alert of context.marketAlerts.slice(0, 3)) {
        const icon = alert.severity === 'critical' ? '🚨' : '▸';
        lines.push(`${icon} ${this.esc(alert.asset)}: ${this.esc(alert.change)}`);
      }
      lines.push('');
    }

    // ── Career Matches ──
    if (context?.careerMatches && context.careerMatches.length > 0) {
      lines.push('<b>💼 Career Matches</b>');
      for (const match of context.careerMatches.slice(0, 3)) {
        const remote = match.remote ? ' (remote)' : '';
        lines.push(`▸ ${this.esc(match.title)} at ${this.esc(match.company)} — ${match.matchScore}%${this.esc(remote)}`);
      }
      lines.push('');
    }

    // ── Issues needing attention ──
    const issues = this.extractIssues(auditData);
    if (issues.length > 0) {
      lines.push('<b>⚠ Needs Attention</b>');
      for (const issue of issues.slice(0, 3)) {
        lines.push(`▸ ${this.esc(issue)}`);
      }
      lines.push('');
    }

    // ── Governance Activity ──
    if (context?.governance) {
      const gov = context.governance;
      const totalVotes = gov.council.votesCompleted;
      const { passed, failed, vetoed } = gov.council.outcomes;
      const hasActivity = totalVotes > 0 || gov.arbiter.evaluations > 0 || gov.overseer.gatesChecked > 0;

      if (hasActivity) {
        lines.push('<b>⚖️ Governance</b>');

        // Council vote summary
        if (totalVotes > 0) {
          const parts: string[] = [];
          if (passed > 0) parts.push(`${passed} passed`);
          if (failed > 0) parts.push(`${failed} failed`);
          if (vetoed > 0) parts.push(`${vetoed} vetoed`);
          lines.push(`▸ Council: ${totalVotes} vote${totalVotes !== 1 ? 's' : ''} (${parts.join(', ')})`);
        }

        // Veto details
        for (const veto of gov.council.vetoes.slice(0, 2)) {
          lines.push(`▸ Veto: ${this.esc(veto.vetoer)} blocked ${this.esc(veto.domain)} — ${this.esc(veto.reason.slice(0, 80))}`);
        }

        // Open votes needing attention
        const urgentVotes = gov.council.openVotes.filter(v => v.deadlineMs < 24 * 60 * 60 * 1000);
        if (urgentVotes.length > 0) {
          lines.push(`▸ ⏰ ${urgentVotes.length} open vote${urgentVotes.length !== 1 ? 's' : ''} (deadline &lt; 24h)`);
        }

        // Arbiter compliance
        if (gov.arbiter.evaluations > 0) {
          const rate = Math.round(gov.arbiter.complianceRate * 100);
          if (gov.arbiter.violations > 0) {
            lines.push(`▸ Arbiter: ${gov.arbiter.violations} violation${gov.arbiter.violations !== 1 ? 's' : ''} (${rate}% compliant)`);
          } else {
            lines.push(`▸ Arbiter: ${gov.arbiter.evaluations} eval${gov.arbiter.evaluations !== 1 ? 's' : ''}, ${rate}% compliant`);
          }
        }

        // Quality gates
        if (gov.overseer.gatesChecked > 0) {
          if (gov.overseer.gatesFailed > 0) {
            lines.push(`▸ 🔴 ${gov.overseer.gatesFailed} quality gate${gov.overseer.gatesFailed !== 1 ? 's' : ''} failing`);
          } else {
            lines.push(`▸ Gates: ${gov.overseer.gatesPassed}/${gov.overseer.gatesChecked} passing`);
          }
        }

        // Pipeline throughput
        if (gov.pipeline.totalEvents > 10) {
          lines.push(`▸ Pipeline: ${gov.pipeline.totalEvents} governance events`);
        }

        lines.push('');
      }
    }

    // ── Closing ──
    lines.push(`Have a strong ${dayName}. Evening check-in at 9.`);

    return lines.join('\n');
  }

  /**
   * Format evening summary as Telegram HTML
   *
   * Structure: results → highlights → issues → build suggestions → closing
   */
  private formatEveningHtml(
    content: BriefingContent,
    auditData: DailyAudit | null,
    context?: EveningContext,
  ): string {
    const lines: string[] = [];

    // ── Header ──
    lines.push('<b>Evening Check-in</b>');
    lines.push('');

    // ── Today's Results ──
    if (auditData) {
      const completed = auditData.activities.filter(a => a.outcome === 'success').length;
      const failed = auditData.activities.filter(a => a.outcome === 'failure').length;
      lines.push(`<b>📊 Today's Results</b>`);
      lines.push(`✓ ${completed} completed · ✗ ${failed} failed`);

      if (content.highlights.length > 0) {
        for (const h of content.highlights.slice(0, 3)) {
          lines.push(`▸ ${this.esc(h)}`);
        }
      }
      lines.push('');
    }

    // ── Changelog ──
    if (content.summary.includes('commit') || content.summary.includes('Commit')) {
      lines.push(`<b>📝 Code Changes</b>`);
      lines.push(this.esc(content.summary.split('\n').filter(l => l.includes('commit') || l.includes('Commit')).slice(0, 3).join('\n') || content.summary.slice(0, 200)));
      lines.push('');
    }

    // ── Open Issues ──
    if (content.issues.length > 0) {
      lines.push('<b>⚠ Open Issues</b>');
      for (const issue of content.issues.slice(0, 3)) {
        lines.push(`▸ ${this.esc(issue)}`);
      }
      lines.push('');
    }

    // ── Tonight's Build Context ──
    if (context?.suggestedTasks && context.suggestedTasks.length > 0) {
      lines.push('<b>🔧 Tonight\'s Build Context</b>');
      for (const task of context.suggestedTasks.slice(0, 3)) {
        lines.push(`▸ ${this.esc(task)}`);
      }
      lines.push('');
    }

    // ── Portfolio P&L ──
    if (context?.portfolio) {
      const p = context.portfolio;
      const dir = p.dailyChangePercent >= 0 ? '📈' : '📉';
      const sign = p.dailyChangePercent >= 0 ? '+' : '';
      lines.push(`<b>${dir} Today's P&amp;L</b>`);
      lines.push(`▸ ${sign}$${Math.abs(p.dailyChange).toLocaleString()} (${sign}${p.dailyChangePercent.toFixed(1)}%)`);
      lines.push('');
    }

    // ── Career Updates ──
    if (context?.careerMatches && context.careerMatches.length > 0) {
      lines.push('<b>💼 New Career Matches</b>');
      for (const match of context.careerMatches.slice(0, 2)) {
        lines.push(`▸ ${this.esc(match.title)} at ${this.esc(match.company)} — ${match.matchScore}%`);
      }
      lines.push('');
    }

    // ── Closing ──
    lines.push('Build strong tonight. I\'m here if you need me.');

    return lines.join('\n');
  }

  /**
   * Format weekly review as Telegram HTML
   */
  private formatWeeklyHtml(
    content: BriefingContent,
    weekData: DailyAudit[],
  ): string {
    const lines: string[] = [];

    lines.push('<b>📊 Weekly Review</b>');
    lines.push('');

    // ── Metrics ──
    const totalActivities = weekData.reduce((sum, d) => sum + d.activities.length, 0);
    const totalSuccess = weekData.reduce(
      (sum, d) => sum + d.activities.filter(a => a.outcome === 'success').length, 0
    );
    const rate = totalActivities > 0 ? Math.round((totalSuccess / totalActivities) * 100) : 0;
    lines.push(`<b>📈 Performance</b>`);
    lines.push(`${totalSuccess}/${totalActivities} tasks successful (${rate}%) across ${weekData.length} days`);
    lines.push('');

    // ── Highlights ──
    if (content.highlights.length > 0) {
      lines.push('<b>🏆 Highlights</b>');
      for (const h of content.highlights.slice(0, 5)) {
        lines.push(`▸ ${this.esc(h)}`);
      }
      lines.push('');
    }

    // ── Issues ──
    if (content.issues.length > 0) {
      lines.push('<b>⚠ Unresolved</b>');
      for (const i of content.issues.slice(0, 3)) {
        lines.push(`▸ ${this.esc(i)}`);
      }
      lines.push('');
    }

    // ── Next Week ──
    if (content.actionItems && content.actionItems.length > 0) {
      lines.push('<b>🎯 Next Week</b>');
      for (const a of content.actionItems.slice(0, 3)) {
        lines.push(`▸ ${this.esc(a)}`);
      }
      lines.push('');
    }

    lines.push('<i>Keep building. Consistency compounds.</i>');

    return lines.join('\n');
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private getContextualGreeting(dayName: string): string {
    const greetings: Record<string, string> = {
      Monday: 'Good morning, Pryce — new week, clean slate',
      Tuesday: 'Good morning, Pryce — momentum building',
      Wednesday: 'Good morning — midweek check-in',
      Thursday: 'Good morning, Pryce — strong push today',
      Friday: 'Good morning, Pryce — finish the week strong',
      Saturday: 'Good morning — build day',
      Sunday: 'Good morning, Pryce — recharge and plan',
    };
    return greetings[dayName] ?? 'Good morning, Pryce';
  }

  private esc(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private async getRecentAuditData(): Promise<DailyAudit | null> {
    try {
      return await dailyAudit.getTodayAudit();
    } catch {
      return null;
    }
  }

  private async getWeekAuditData(): Promise<DailyAudit[]> {
    const audits: DailyAudit[] = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      try {
        const audit = await dailyAudit.getAudit(dateStr);
        if (audit) audits.push(audit);
      } catch {
        // Day not available, skip
      }
    }
    return audits;
  }

  private buildMorningSummary(
    dayName: string,
    queueResult: { processed: number; sent: number },
    auditData: DailyAudit | null
  ): string {
    const lines: string[] = [];

    lines.push(`Happy ${dayName}!`);
    lines.push('');

    if (queueResult.processed > 0) {
      lines.push(`${queueResult.processed} items queued overnight have been processed.`);
    } else {
      lines.push('No items queued overnight. Clean slate!');
    }

    if (auditData) {
      const completedCount = auditData.activities.filter(
        (a) => a.outcome === 'success'
      ).length;
      if (completedCount > 0) {
        lines.push(`Yesterday: ${completedCount} tasks completed.`);
      }
    }

    return lines.join('\n');
  }

  private async buildEveningSummary(auditData: DailyAudit | null): Promise<string> {
    const lines: string[] = [];

    if (!auditData) {
      lines.push('No audit data available for today.');
    } else {
      const completed = auditData.activities.filter((a) => a.outcome === 'success').length;
      const failed = auditData.activities.filter((a) => a.outcome === 'failure').length;

      lines.push(`Today's wrap-up: ${completed} completed, ${failed} failed.`);

      if (auditData.highlights && auditData.highlights.length > 0) {
        lines.push('');
        lines.push('Key accomplishments:');
        auditData.highlights.slice(0, 3).forEach((h) => {
          lines.push(`• ${h}`);
        });
      }
    }

    // Add changelog summary
    if (this.changelogGenerator) {
      try {
        const changelogSummary = await this.changelogGenerator.getSummaryForBriefing();
        if (changelogSummary) {
          lines.push('');
          lines.push(changelogSummary);
        }
      } catch {
        // Skip changelog if it fails
      }
    }

    return lines.join('\n');
  }

  private buildWeeklySummary(weekData: DailyAudit[]): string {
    const totalActivities = weekData.reduce(
      (sum, d) => sum + d.activities.length,
      0
    );
    const totalSuccess = weekData.reduce(
      (sum, d) => sum + d.activities.filter((a) => a.outcome === 'success').length,
      0
    );

    return `Week in review: ${totalSuccess}/${totalActivities} tasks successful across ${weekData.length} days.`;
  }

  private extractHighlights(auditData: DailyAudit | null): string[] {
    if (!auditData || !auditData.highlights) {
      return [];
    }
    return auditData.highlights.slice(0, 5);
  }

  private extractIssues(auditData: DailyAudit | null): string[] {
    if (!auditData) {
      return [];
    }

    return auditData.activities
      .filter((a) => a.outcome === 'failure')
      .map((a) => a.title)
      .slice(0, 5);
  }

  private extractWeeklyHighlights(weekData: DailyAudit[]): string[] {
    return weekData
      .flatMap((d) => d.highlights ?? [])
      .slice(0, 10);
  }

  private extractWeeklyIssues(weekData: DailyAudit[]): string[] {
    return weekData
      .flatMap((d) =>
        d.activities
          .filter((a) => a.outcome === 'failure')
          .map((a) => a.title)
      )
      .slice(0, 10);
  }

  private buildDayMetrics(auditData: DailyAudit | null): Record<string, string | number> {
    if (!auditData) {
      return {};
    }

    const activities = auditData.activities;
    const success = activities.filter((a) => a.outcome === 'success').length;
    const failed = activities.filter((a) => a.outcome === 'failure').length;

    return {
      totalTasks: activities.length,
      successful: success,
      failed,
      successRate: activities.length > 0
        ? `${Math.round((success / activities.length) * 100)}%`
        : 'N/A',
    };
  }

  private buildWeekMetrics(weekData: DailyAudit[]): Record<string, string | number> {
    const totalActivities = weekData.reduce(
      (sum, d) => sum + d.activities.length,
      0
    );
    const totalSuccess = weekData.reduce(
      (sum, d) => sum + d.activities.filter((a) => a.outcome === 'success').length,
      0
    );

    return {
      daysTracked: weekData.length,
      totalTasks: totalActivities,
      successful: totalSuccess,
      weeklySuccessRate: totalActivities > 0
        ? `${Math.round((totalSuccess / totalActivities) * 100)}%`
        : 'N/A',
    };
  }

  private suggestNextWeekPriorities(weekData: DailyAudit[]): string[] {
    const failedTasks = weekData
      .flatMap((d) =>
        d.activities
          .filter((a) => a.outcome === 'failure')
          .map((a) => a.title)
      );

    const unique = [...new Set(failedTasks)];
    return unique.slice(0, 3).map((t) => `Retry: ${t}`);
  }

  private formatEveningSummary(content: BriefingContent): string {
    const parts: string[] = [];

    parts.push(content.summary);

    if (content.highlights.length > 0) {
      parts.push('');
      parts.push('Highlights:');
      content.highlights.slice(0, 3).forEach(h => {
        parts.push(`- ${h}`);
      });
    }

    if (content.issues.length > 0) {
      parts.push('');
      parts.push('Open issues:');
      content.issues.slice(0, 3).forEach(i => {
        parts.push(`- ${i}`);
      });
    }

    return parts.join('\n');
  }

  private formatMorningSMS(
    content: BriefingContent,
    queueResult: { processed: number; sent: number }
  ): string {
    const parts: string[] = [];

    if (queueResult.processed > 0) {
      parts.push(`${queueResult.processed} items processed`);
    }

    if (content.issues.length > 0) {
      parts.push(`${content.issues.length} issues need attention`);
    }

    if (parts.length === 0) {
      return 'All clear! Check Notion for details.';
    }

    return `${parts.join(', ')}. Check Notion.`;
  }
}

// Factory function for creating briefing generator
export function createBriefingGenerator(
  notificationManager: NotificationManager
): BriefingGenerator {
  return new BriefingGenerator(notificationManager);
}
