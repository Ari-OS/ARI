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

import fs from 'node:fs/promises';
import path from 'node:path';
import { NotificationManager } from './notification-manager.js';
import { NotionInbox } from '../integrations/notion/inbox.js';
import { dailyAudit, type DailyAudit } from './daily-audit.js';
import { ChangelogGenerator } from './changelog-generator.js';
import { EventBus } from '../kernel/event-bus.js';
import { splitTelegramMessage } from '../plugins/telegram-bot/format.js';
import type { SpeechGenerator } from '../plugins/tts/speech-generator.js';
import type { NotionConfig } from './types.js';
import type { DailyDigest } from './daily-digest.js';
import type { LifeMonitorReport } from './life-monitor.js';
import type { GovernanceSnapshot } from './governance-reporter.js';
import type { IntelligenceItem } from './intelligence-scanner.js';
import type { CoinGeckoGlobalData } from '../plugins/crypto/types.js';

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
  audioSent?: boolean;
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
  calendarEvents?: Array<{
    title: string;
    startDate: Date;
    endDate: Date;
    location?: string;
    isAllDay: boolean;
  }> | null;
  pendingReminders?: Array<{
    name: string;
    dueDate?: Date;
    priority: number;
    list: string;
  }> | null;
  weather?: {
    location: string;
    tempF: number;
    condition: string;
    feelsLikeF: number;
    humidity: number;
    forecast?: Array<{ date: string; maxTempF: number; minTempF: number; condition: string; chanceOfRain: number }>;
  } | null;
  techNews?: Array<{
    title: string;
    url?: string;
    score?: number;
    source: string;
  }> | null;
  /** GitHub notifications (unread) */
  githubNotifications?: Array<{
    id: string;
    reason: string;
    subject: { title: string; type: string };
    repository: string;
  }> | null;
  /** Upcoming earnings reports (next 5 trading days) */
  upcomingEarnings?: Array<{
    symbol: string;
    name: string;
    daysUntil: number;
    estimate: number | null;
  }> | null;
  /** AI-generated Perplexity morning brief */
  perplexityBriefing?: {
    answer: string;
    citations: string[];
  } | null;
  /** CoinGecko global market data (BTC/ETH dominance, sentiment) */
  cryptoGlobal?: CoinGeckoGlobalData | null;
}

export interface LlmCostSummary {
  totalUsd: number;
  requestCount: number;
  topModel: string;
  budgetUtilization: number; // 0-100 percent of monthly budget
  avgLatencyMs?: number;
}

export interface EveningContext {
  suggestedTasks?: string[];
  careerMatches?: Array<{
    title: string;
    company: string;
    matchScore: number;
  }> | null;
  portfolio?: BriefingPortfolio | null;
  llmCostToday?: LlmCostSummary | null;
  governance?: GovernanceSnapshot | null;
  /** Autonomy dial level (0-100) */
  autonomyLevel?: number | null;
  /** CRM contacts needing follow-up */
  crmFollowUps?: Array<{ name: string; daysSince: number; urgency: string }> | null;
  /** Pending soul evolution proposals */
  soulProposals?: Array<{ trait: string; direction: string }> | null;
  /** Human 3.0 quadrant scores */
  quadrantScores?: { mind: number; body: number; spirit: number; vocation: number } | null;
}

export interface WeeklyContext {
  /** 7-day governance window snapshot */
  governance?: GovernanceSnapshot | null;
  /** Top insights from weekly wisdom / self-improvement loop */
  topInsights?: string[] | null;
}

export interface WorkdayDigestContext {
  marketAlerts?: Array<{ asset: string; change: string; severity: string }> | null;
  portfolio?: BriefingPortfolio | null;
}

// ─── Briefing Generator ─────────────────────────────────────────────────────

export class BriefingGenerator {
  private notificationManager: NotificationManager;
  private eventBus: EventBus | null = null;
  private notion: NotionInbox | null = null;
  private changelogGenerator: ChangelogGenerator | null = null;
  private speechGenerator: SpeechGenerator | null = null;
  private timezone = 'America/Indiana/Indianapolis';

  constructor(
    notificationManager: NotificationManager,
    eventBus?: EventBus,
    speechGenerator?: SpeechGenerator,
  ) {
    this.notificationManager = notificationManager;
    if (eventBus) {
      this.eventBus = eventBus;
      this.changelogGenerator = new ChangelogGenerator(eventBus, process.cwd());
    }
    if (speechGenerator) {
      this.speechGenerator = speechGenerator;
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

    // Generate and send voice audio if ElevenLabs is configured
    let audioSent = false;
    if (this.speechGenerator) {
      try {
        const speechResult = await this.speechGenerator.speak({
          text: smsMessage,
          requestedBy: 'briefings',
        });
        audioSent = await this.notificationManager.sendVoice(speechResult.audioBuffer);
      } catch {
        // Voice is optional — text briefing already delivered successfully
      }
    }

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
          audioSent,
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
      audioSent,
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
  async weeklyReview(context?: WeeklyContext): Promise<BriefingResult> {
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
    const telegramHtml = this.formatWeeklyHtml(content, weekData, context);

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

  /**
   * Generate and send 4 PM workday digest
   *
   * Always sends — even when nothing was queued — so Pryce
   * gets the "family time" signal and a market pulse to close the work day.
   */
  async workdayDigest(context?: WorkdayDigestContext): Promise<BriefingResult> {
    // Flush any queued notifications first
    const queueResult = await this.notificationManager.processQueue();

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: this.timezone,
    });

    const lines: string[] = [];
    lines.push(`<b>⏰ Work Day Wrap — ${timeStr}</b>`);
    lines.push('');

    // Queued items (only shown if there were any)
    if (queueResult.processed > 0) {
      lines.push('<b>📬 Queued Items</b>');
      lines.push(`▸ ${queueResult.processed} item${queueResult.processed !== 1 ? 's' : ''} flushed (${queueResult.sent} sent)`);
      lines.push('');
    }

    // Market pulse (only shown if data available)
    if (context?.portfolio || (context?.marketAlerts && context.marketAlerts.length > 0)) {
      lines.push('<b>📈 Market Pulse</b>');
      const pulseLines: string[] = [];
      if (context?.portfolio) {
        const p = context.portfolio;
        const sign = p.dailyChangePercent >= 0 ? '+' : '';
        const arrow = p.dailyChangePercent >= 0 ? '↑' : '↓';
        pulseLines.push(`Portfolio  $${p.totalValue.toLocaleString()}  ${arrow} ${sign}${p.dailyChangePercent.toFixed(1)}%`);
      }
      if (context?.marketAlerts) {
        for (const alert of context.marketAlerts.slice(0, 3)) {
          const icon = alert.severity === 'critical' ? '🚨' : '⚠';
          pulseLines.push(`${icon} ${this.esc(alert.asset).padEnd(6)}  ${this.esc(alert.change)}  (${this.esc(alert.severity)})`);
        }
      }
      if (pulseLines.length > 0) {
        lines.push(`<pre>${pulseLines.join('\n')}</pre>`);
      }
      lines.push('');
    }

    lines.push('Family time. Back online at 9. 🏠');

    const telegramHtml = splitTelegramMessage(lines.join('\n'));

    const notifyResult = await this.notificationManager.notify({
      category: 'daily',
      title: 'Work Day Wrap',
      body: `Work day done. ${queueResult.processed > 0 ? `${queueResult.processed} items flushed.` : 'Queue clear.'} Family time.`,
      priority: 'normal',
      telegramHtml,
    });

    await dailyAudit.logActivity(
      'system_event',
      'Work Day Wrap',
      `Processed ${queueResult.processed} queued items`,
      {
        outcome: 'success',
        details: { type: 'workday_digest', processed: queueResult.processed, sent: queueResult.sent },
      }
    );

    return {
      success: true,
      smsSent: notifyResult.sent,
    };
  }

  /**
   * Generate and send X Likes Curated Digest (~8 PM)
   *
   * Reads today's intelligence scan results, filters for items sourced
   * from X likes, groups by domain, and surfaces the most relevant ones
   * as a scannable evening reading list.
   */
  async xLikesDigest(): Promise<BriefingResult> {
    const INTEL_DIR = path.join(process.env.HOME ?? '~', '.ari', 'knowledge', 'intelligence');
    const SCAN_LOG = path.join(INTEL_DIR, 'scan-log.json');

    let socialItems: IntelligenceItem[] = [];

    try {
      const raw = await fs.readFile(SCAN_LOG, 'utf-8');
      const scanResult = JSON.parse(raw) as { topItems: IntelligenceItem[]; startedAt: string };
      // Only use items from today's scan (within last 18 hours)
      const cutoffMs = Date.now() - 18 * 60 * 60 * 1000;
      const scanAge = new Date(scanResult.startedAt).getTime();
      if (scanAge > cutoffMs) {
        socialItems = scanResult.topItems
          .filter(item => item.sourceCategory === 'SOCIAL')
          .sort((a, b) => b.score - a.score)
          .slice(0, 12);
      }
    } catch {
      // No scan available yet — send empty digest
    }

    const telegramHtml = splitTelegramMessage(this.formatXLikesHtml(socialItems));

    const notifyResult = await this.notificationManager.notify({
      category: 'daily',
      title: 'Your Reading List',
      body: socialItems.length > 0
        ? `${socialItems.length} posts from today's likes curated for you.`
        : 'Nothing from your X likes today — clean slate.',
      priority: 'low',
      telegramHtml,
    });

    await dailyAudit.logActivity(
      'system_event',
      'X Likes Digest',
      `Curated ${socialItems.length} social items`,
      { outcome: 'success', details: { type: 'x_likes_digest', count: socialItems.length } }
    );

    return { success: true, smsSent: notifyResult.sent };
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
  ): string[] {
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

    // ── Weather ──
    if (context?.weather) {
      const w = context.weather;
      lines.push(`<b>🌤 Weather — ${this.esc(w.location)}</b>`);
      lines.push(`<blockquote>${w.tempF}°F (feels like ${w.feelsLikeF}°F) · ${this.esc(w.condition)}`);
      if (w.forecast && w.forecast.length > 0) {
        const today = w.forecast[0];
        lines.push(`High ${today.maxTempF}°F / Low ${today.minTempF}°F${today.chanceOfRain > 20 ? ` · ${today.chanceOfRain}% rain` : ''}`);
      }
      lines.push(`</blockquote>\n`);
    }

    // ── Today's Schedule ──
    if (context?.calendarEvents && context.calendarEvents.length > 0) {
      lines.push('<b>📅 Today\'s Schedule</b>');
      const sorted = [...context.calendarEvents]
        .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
      const allDay = sorted.filter(e => e.isAllDay);
      const timed = sorted.filter(e => !e.isAllDay);
      lines.push('<blockquote>');
      for (const evt of allDay.slice(0, 2)) {
        lines.push(`<b>All day:</b> ${this.esc(evt.title)}`);
      }
      for (const evt of timed.slice(0, 5)) {
        const time = evt.startDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          timeZone: this.timezone,
        });
        const loc = evt.location ? ` @ ${this.esc(evt.location)}` : '';
        lines.push(`<b>${time}</b> — ${this.esc(evt.title)}${loc}`);
      }
      if (context.calendarEvents.length > 7) {
        lines.push(`<i>+ ${context.calendarEvents.length - 7} more events</i>`);
      }
      lines.push(`</blockquote>\n`);
    }

    // ── Pending Reminders ──
    if (context?.pendingReminders && context.pendingReminders.length > 0) {
      const overdue = context.pendingReminders.filter(r => r.dueDate && r.dueDate < new Date());
      const dueToday = context.pendingReminders.filter(r => {
        if (!r.dueDate) return false;
        const eod = new Date();
        eod.setHours(23, 59, 59, 999);
        return r.dueDate >= new Date() && r.dueDate <= eod;
      });

      if (overdue.length > 0 || dueToday.length > 0) {
        lines.push('<b>📝 Reminders</b>');
        lines.push('<blockquote>');
        for (const r of overdue.slice(0, 3)) {
          lines.push(`🔴 <b>OVERDUE:</b> ${this.esc(r.name)}`);
        }
        for (const r of dueToday.slice(0, 3)) {
          lines.push(`⏱ <b>Due today:</b> ${this.esc(r.name)}`);
        }
        lines.push(`</blockquote>\n`);
      }
    }

    // ── Intelligence Highlights ──
    if (context?.digest && context.digest.sections.length > 0) {
      lines.push('<b>📰 Today\'s Intel</b>');
      lines.push('<blockquote>');
      const topItems = context.digest.sections
        .flatMap(s => s.items)
        .slice(0, 4);
      for (const item of topItems) {
        const headline = this.esc(item.headline.slice(0, 100));
        if (item.url) {
          lines.push(`• <a href="${item.url}">${headline}</a>`);
        } else {
          lines.push(`• ${headline}`);
        }
      }
      if (context.digest.stats.itemsIncluded > 4) {
        lines.push(`<i>+ ${context.digest.stats.itemsIncluded - 4} more in full digest</i>`);
      }
      lines.push(`</blockquote>\n`);
    }

    // ── Tech News (HN + RSS) ──
    if (context?.techNews && context.techNews.length > 0) {
      lines.push('<b>🔗 Tech Headlines</b>');
      lines.push('<blockquote>');
      for (const item of context.techNews.slice(0, 5)) {
        const title = this.esc(item.title.slice(0, 100));
        const score = item.score ? ` <i>(${item.score}pts)</i>` : '';
        if (item.url) {
          lines.push(`• <a href="${item.url}">${title}</a>${score}`);
        } else {
          lines.push(`• ${title}${score}`);
        }
      }
      lines.push(`</blockquote>\n`);
    }

    // ── ARI's Take (from digest) ──
    if (context?.digest?.ariTake && context.digest.ariTake.length > 0) {
      lines.push('<b>💡 ARI\'s Take</b>');
      lines.push('<blockquote>');
      for (const take of context.digest.ariTake.slice(0, 2)) {
        lines.push(`🧠 ${this.esc(take.slice(0, 150))}`);
      }
      lines.push(`</blockquote>\n`);
    }

    // ── Life Monitor Alerts ──
    if (context?.lifeMonitorReport && context.lifeMonitorReport.alerts.length > 0) {
      const report = context.lifeMonitorReport;
      const alertIcon = report.criticalCount > 0 ? '🔴' : report.urgentCount > 0 ? '🟠' : '🟡';
      lines.push(`<b>${alertIcon} Action Items</b>`);
      lines.push(`<blockquote>${this.esc(report.summary.slice(0, 200))}</blockquote>\n`);
    }

    // ── Portfolio Snapshot ──
    if (context?.portfolio) {
      const p = context.portfolio;
      const dir = p.dailyChangePercent >= 0 ? '📈' : '📉';
      const sign = p.dailyChangePercent >= 0 ? '+' : '';
      const arrow = p.dailyChangePercent >= 0 ? '↑' : '↓';
      lines.push(`<b>${dir} Portfolio</b>`);
      lines.push('<blockquote>');
      lines.push(`<b>$${p.totalValue.toLocaleString()}</b> ${arrow} ${sign}${p.dailyChangePercent.toFixed(1)}% today`);
      if (p.topGainers.length > 0) {
        const top = p.topGainers[0];
        lines.push(`🚀 <b>Top:</b> ${this.esc(top.asset)} ↑ +${top.changePercent.toFixed(1)}%`);
      }
      if (p.topLosers.length > 0) {
        const worst = p.topLosers[0];
        lines.push(`🩸 <b>Dip:</b> ${this.esc(worst.asset)} ↓ ${worst.changePercent.toFixed(1)}%`);
      }
      lines.push(`</blockquote>\n`);
    }

    // ── Market Alerts ──
    if (context?.marketAlerts && context.marketAlerts.length > 0) {
      lines.push('<b>🔔 Market Alerts</b>');
      lines.push('<blockquote>');
      for (const alert of context.marketAlerts.slice(0, 3)) {
        const icon = alert.severity === 'critical' ? '🔴' : '🟡';
        lines.push(`${icon} <b>${this.esc(alert.asset)}:</b> ${this.esc(alert.change)}`);
      }
      lines.push(`</blockquote>\n`);
    }

    // ── Crypto Global (BTC/ETH Dominance + Sentiment) ──
    if (context?.cryptoGlobal) {
      const g = context.cryptoGlobal;
      const changeSign = g.totalMarketCapChangePercent >= 0 ? '+' : '';
      const sentimentIcon = g.totalMarketCapChangePercent >= 2 ? '🟢'
        : g.totalMarketCapChangePercent <= -2 ? '🔴' : '🟡';
      lines.push('<b>🌐 Crypto Sentiment</b>');
      const row = [
        `BTC ${g.btcDominance.toFixed(1)}%`,
        `ETH ${g.ethDominance.toFixed(1)}%`,
        `Mkt ${changeSign}${g.totalMarketCapChangePercent.toFixed(1)}% ${sentimentIcon}`,
      ];
      lines.push(`<code>${row.join('  ·  ')}</code>`);
      lines.push('');
    }

    // ── Perplexity AI Morning Brief ──
    if (context?.perplexityBriefing?.answer) {
      lines.push('<b>🤖 AI Morning Brief</b>');
      lines.push(this.esc(context.perplexityBriefing.answer.slice(0, 400)));
      if (context.perplexityBriefing.citations.length > 0) {
        lines.push(`  <i>via ${this.esc(context.perplexityBriefing.citations[0].slice(0, 60))}</i>`);
      }
      lines.push('');
    }

    // ── GitHub Notifications ──
    if (context?.githubNotifications && context.githubNotifications.length > 0) {
      lines.push('<b>🔔 GitHub</b>');
      const grouped = new Map<string, number>();
      for (const n of context.githubNotifications) {
        grouped.set(n.repository, (grouped.get(n.repository) ?? 0) + 1);
      }
      const sorted = [...grouped.entries()].sort((a, b) => b[1] - a[1]);
      for (const [repo, count] of sorted.slice(0, 4)) {
        lines.push(`▸ ${this.esc(repo)}: ${count} notification${count !== 1 ? 's' : ''}`);
      }
      if (context.githubNotifications.length > 5) {
        lines.push(`  <i>${context.githubNotifications.length} total unread</i>`);
      }
      lines.push('');
    }

    // ── Upcoming Earnings ──
    if (context?.upcomingEarnings && context.upcomingEarnings.length > 0) {
      lines.push('<b>📅 Earnings Watch</b>');
      for (const e of context.upcomingEarnings.slice(0, 4)) {
        const when = e.daysUntil === 0 ? 'Today' : e.daysUntil === 1 ? 'Tomorrow' : `in ${e.daysUntil}d`;
        const est = e.estimate !== null ? ` — est. $${e.estimate.toFixed(2)} EPS` : '';
        lines.push(`▸ ${this.esc(e.symbol)} (${this.esc(e.name)}) ${when}${est}`);
      }
      lines.push('');
    }

    // ── Career Matches ──
    if (context?.careerMatches && context.careerMatches.length > 0) {
      lines.push('<b>💼 Career Matches</b>');
      lines.push('<blockquote>');
      for (const match of context.careerMatches.slice(0, 3)) {
        const remote = match.remote ? ' <i>(remote)</i>' : '';
        lines.push(`🎯 <b>${this.esc(match.title)}</b> at ${this.esc(match.company)} — ${match.matchScore}%${remote}`);
      }
      lines.push(`</blockquote>\n`);
    }

    // ── Issues needing attention ──
    const issues = this.extractIssues(auditData);
    if (issues.length > 0) {
      lines.push('<b>⚠ Needs Attention</b>');
      lines.push('<blockquote>');
      for (const issue of issues.slice(0, 3)) {
        lines.push(`• ${this.esc(issue)}`);
      }
      lines.push(`</blockquote>\n`);
    }

    // ── Governance Activity ──
    if (context?.governance) {
      const gov = context.governance;
      const totalVotes = gov.council.votesCompleted;
      const { passed, failed, vetoed } = gov.council.outcomes;
      const hasActivity = totalVotes > 0 || gov.arbiter.evaluations > 0 || gov.overseer.gatesChecked > 0;

      if (hasActivity) {
        lines.push('<b>⚖️ Governance</b>');
        lines.push('<blockquote>');

        // Council vote summary
        if (totalVotes > 0) {
          const parts: string[] = [];
          if (passed > 0) parts.push(`✅ ${passed} passed`);
          if (failed > 0) parts.push(`❌ ${failed} failed`);
          if (vetoed > 0) parts.push(`🛑 ${vetoed} vetoed`);
          lines.push(`<b>Council:</b> ${totalVotes} vote${totalVotes !== 1 ? 's' : ''} (${parts.join(', ')})`);
        }

        // Veto details
        for (const veto of gov.council.vetoes.slice(0, 2)) {
          lines.push(`🛑 <b>Veto:</b> ${this.esc(veto.vetoer)} blocked ${this.esc(veto.domain)} — <i>${this.esc(veto.reason.slice(0, 80))}</i>`);
        }

        // Open votes needing attention
        const urgentVotes = gov.council.openVotes.filter(v => v.deadlineMs < 24 * 60 * 60 * 1000);
        if (urgentVotes.length > 0) {
          lines.push(`⏰ <b>${urgentVotes.length} open vote${urgentVotes.length !== 1 ? 's' : ''}</b> (deadline &lt; 24h)`);
        }

        // Arbiter compliance
        if (gov.arbiter.evaluations > 0) {
          const rate = Math.round(gov.arbiter.complianceRate);
          if (gov.arbiter.violations > 0) {
            lines.push(`<b>Arbiter:</b> ${gov.arbiter.violations} violation${gov.arbiter.violations !== 1 ? 's' : ''} (${rate}% compliant)`);
          } else {
            lines.push(`<b>Arbiter:</b> ${gov.arbiter.evaluations} eval${gov.arbiter.evaluations !== 1 ? 's' : ''}, ${rate}% compliant`);
          }
        }

        // Quality gates
        if (gov.overseer.gatesChecked > 0) {
          if (gov.overseer.gatesFailed > 0) {
            lines.push(`🔴 <b>${gov.overseer.gatesFailed} quality gate${gov.overseer.gatesFailed !== 1 ? 's' : ''} failing</b>`);
          } else {
            lines.push(`<b>Gates:</b> ${gov.overseer.gatesPassed}/${gov.overseer.gatesChecked} passing`);
          }
        }

        // Pipeline throughput
        if (gov.pipeline.totalEvents > 10) {
          lines.push(`<b>Pipeline:</b> ${gov.pipeline.totalEvents} governance events`);
        }

        lines.push(`</blockquote>\n`);
      }
    }

    // ── Closing ──
    lines.push(`Have a strong ${dayName}. Evening check-in at 9.`);

    const fullHtml = lines.join('\n');
    // Split into multiple messages if exceeding Telegram's 4096-char limit
    return splitTelegramMessage(fullHtml);
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
  ): string[] {
    const lines: string[] = [];

    // ── Header ──
    lines.push('<b>Evening Check-in</b>');
    lines.push('');

    // ── Today's Results ──
    if (auditData) {
      const completed = auditData.activities.filter(a => a.outcome === 'success').length;
      const failed = auditData.activities.filter(a => a.outcome === 'failure').length;
      const total = completed + failed;
      const successPct = total > 0 ? Math.round((completed / total) * 100) : 100;
      const bar = this.buildUtilizationBar(successPct);
      lines.push(`<b>📊 Today's Results</b>`);
      lines.push(`✓ ${completed}   ✗ ${failed}   <code>${bar}</code>  ${successPct}%`);

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

    // ── Council Brief ──
    if (context?.governance) {
      const councilLines = this.formatCouncilBrief(context.governance);
      if (councilLines.length > 0) {
        lines.push(...councilLines);
        lines.push('');
      }
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
      const arrow = p.dailyChangePercent >= 0 ? '↑' : '↓';
      lines.push(`<b>${dir} Today's P&amp;L</b>`);
      const preLines: string[] = [];
      preLines.push(`Total  $${p.totalValue.toLocaleString().padStart(10)}  ${arrow} ${sign}${p.dailyChangePercent.toFixed(1)}%`);
      if (p.topGainers.length > 0) {
        for (const g of p.topGainers.slice(0, 2)) {
          preLines.push(`${this.esc(g.asset).padEnd(6)} ${''.padStart(10)}  ↑ +${g.changePercent.toFixed(1)}%`);
        }
      }
      if (p.topLosers.length > 0) {
        for (const l of p.topLosers.slice(0, 1)) {
          preLines.push(`${this.esc(l.asset).padEnd(6)} ${''.padStart(10)}  ↓ ${l.changePercent.toFixed(1)}%`);
        }
      }
      lines.push(`<pre>${preLines.join('\n')}</pre>`);
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

    // ── AI Cost Dashboard ──
    if (context?.llmCostToday) {
      const c = context.llmCostToday;
      const utilizationBar = this.buildUtilizationBar(c.budgetUtilization);
      const budgetIcon = c.budgetUtilization >= 85 ? '🔴' : c.budgetUtilization >= 60 ? '🟡' : '🟢';
      lines.push('<b>🤖 AI Costs Today</b>');
      lines.push(`▸ ${budgetIcon} $${c.totalUsd.toFixed(4)} across ${c.requestCount} requests`);
      lines.push(`▸ Top model: ${this.esc(c.topModel)} · ${utilizationBar} ${c.budgetUtilization.toFixed(1)}% of budget`);
      if (c.avgLatencyMs !== undefined) {
        lines.push(`▸ Avg latency: ${c.avgLatencyMs.toFixed(0)}ms`);
      }
      lines.push('');
    }

    // ── CRM Follow-ups ──
    if (context?.crmFollowUps && context.crmFollowUps.length > 0) {
      lines.push('<b>📇 CRM Follow-ups</b>');
      for (const c of context.crmFollowUps.slice(0, 3)) {
        const icon = c.urgency === 'critical' ? '🔴' : c.urgency === 'high' ? '🟡' : '⚪';
        lines.push(`▸ ${icon} ${this.esc(c.name)} — ${c.daysSince}d since last contact`);
      }
      lines.push('');
    }

    // ── Soul Evolution ──
    if (context?.soulProposals && context.soulProposals.length > 0) {
      lines.push('<b>🌱 Soul Proposals Pending</b>');
      for (const p of context.soulProposals.slice(0, 3)) {
        lines.push(`▸ ${this.esc(p.trait)}: ${this.esc(p.direction)}`);
      }
      lines.push('');
    }

    // ── Human 3.0 Quadrant Scores ──
    if (context?.quadrantScores) {
      const q = context.quadrantScores;
      lines.push('<b>🧭 Life Balance</b>');
      lines.push(`▸ 🧠 Mind ${q.mind}/100 · 💪 Body ${q.body}/100`);
      lines.push(`▸ 🙏 Spirit ${q.spirit}/100 · 💼 Vocation ${q.vocation}/100`);
      lines.push('');
    }

    // ── Autonomy Dial ──
    if (context?.autonomyLevel !== undefined && context.autonomyLevel !== null) {
      const level = context.autonomyLevel;
      const icon = level >= 80 ? '🟢' : level >= 50 ? '🟡' : '🔴';
      lines.push(`${icon} <b>Autonomy:</b> ${level}%`);
      lines.push('');
    }

    // ── Closing ──
    lines.push('Make it count tonight.');

    const fullHtml = lines.join('\n');
    // Split into multiple messages if exceeding Telegram's 4096-char limit
    return splitTelegramMessage(fullHtml);
  }

  /**
   * Format weekly review as Telegram HTML
   *
   * Uses ━━ divider sections for scannability.
   */
  private formatWeeklyHtml(
    content: BriefingContent,
    weekData: DailyAudit[],
    context?: WeeklyContext,
  ): string[] {
    const lines: string[] = [];

    // ── Header with week number + date range ──
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNumber = Math.ceil((now.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000));

    // Derive Monday–Sunday of current week in Indiana timezone
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'short', timeZone: this.timezone });
    const daysMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const todayIdx = daysMap[dayOfWeek] ?? 0;
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((todayIdx + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const fmt = (d: Date): string => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: this.timezone });
    const dateRange = `${fmt(monday)}–${fmt(sunday)}`;

    lines.push(`<b>📊 Weekly Review — Week ${weekNumber}</b>`);
    lines.push(`<i>${dateRange}</i>`);
    lines.push('');

    // ── Performance ──
    const totalActivities = weekData.reduce((sum, d) => sum + d.activities.length, 0);
    const totalSuccess = weekData.reduce(
      (sum, d) => sum + d.activities.filter(a => a.outcome === 'success').length, 0
    );
    const rate = totalActivities > 0 ? Math.round((totalSuccess / totalActivities) * 100) : 100;
    const perfBar = this.buildUtilizationBar(rate);
    lines.push('<b>━━ Performance ━━━━━━━━━━━━━━━━━━━━━━━</b>');
    lines.push(`${totalSuccess}/${totalActivities} tasks · ${weekData.length} days · <code>${perfBar}</code> ${rate}%`);
    lines.push('');

    // ── Council Chamber (if governance provided) ──
    if (context?.governance && context.governance.pipeline.totalEvents > 0) {
      const gov = context.governance;
      lines.push('<b>━━ Council Chamber ━━━━━━━━━━━━━━━━━━━</b>');
      lines.push(`Votes this week: ${gov.council.votesCompleted}`);

      const { passed, failed, vetoed, expired } = gov.council.outcomes;
      lines.push(`<code>✅ ${passed}   ❌ ${failed}   🛑 ${vetoed}   ⌛ ${expired}</code>`);

      const topics = gov.council.topicsSummary.slice(0, 3);
      if (topics.length > 0) {
        lines.push(`Topics: ${topics.map(t => this.esc(t)).join(' · ')}`);
      }

      if (vetoed > 0 && gov.council.vetoes.length > 0) {
        const veto = gov.council.vetoes[0];
        lines.push(`🛑 ${this.esc(veto.vetoer)} vetoed ${this.esc(veto.domain)} — <i>"${this.esc(veto.reason.slice(0, 80))}"</i>`);
      }

      if (gov.arbiter.evaluations > 0) {
        const arbiterRate = Math.round(gov.arbiter.complianceRate);
        const bar = this.buildUtilizationBar(arbiterRate);
        lines.push(`Arbiter  <code>${bar}</code>  ${arbiterRate}%  (${gov.arbiter.evaluations} evals, ${gov.arbiter.violations} violations)`);
      }

      if (gov.overseer.gatesChecked > 0) {
        lines.push(`Gates: ${gov.overseer.gatesPassed}/${gov.overseer.gatesChecked}`);
      }

      lines.push('');
    }

    // ── Insights (if provided) ──
    if (context?.topInsights && context.topInsights.length > 0) {
      lines.push('<b>━━ Insights ━━━━━━━━━━━━━━━━━━━━━━━━━━</b>');
      for (const insight of context.topInsights.slice(0, 3)) {
        lines.push(`▸ ${this.esc(insight)}`);
      }
      lines.push('');
    }

    // ── Highlights ──
    if (content.highlights.length > 0) {
      lines.push('<b>━━ Highlights ━━━━━━━━━━━━━━━━━━━━━━━━</b>');
      for (const h of content.highlights.slice(0, 5)) {
        lines.push(`▸ ${this.esc(h)}`);
      }
      lines.push('');
    }

    // ── Unresolved ──
    if (content.issues.length > 0) {
      lines.push('<b>━━ Unresolved ━━━━━━━━━━━━━━━━━━━━━━━━</b>');
      for (const i of content.issues.slice(0, 3)) {
        lines.push(`▸ ${this.esc(i)}`);
      }
      lines.push('');
    }

    // ── Next Week ──
    if (content.actionItems && content.actionItems.length > 0) {
      lines.push('<b>━━ Next Week ━━━━━━━━━━━━━━━━━━━━━━━━</b>');
      for (const a of content.actionItems.slice(0, 3)) {
        lines.push(`▸ ${this.esc(a)}`);
      }
      lines.push('');
    }

    lines.push('<i>Keep building. Consistency compounds.</i>');

    const fullHtml = lines.join('\n');
    // Split into multiple messages if exceeding Telegram's 4096-char limit
    return splitTelegramMessage(fullHtml);
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  /**
   * Format a compact "Council Brief" section for evening/weekly reports.
   * Returns [] when totalEvents === 0 so callers can skip the section entirely.
   */
  private formatCouncilBrief(gov: GovernanceSnapshot): string[] {
    if (gov.pipeline.totalEvents === 0) {
      return [];
    }

    const lines: string[] = [];
    lines.push('<b>⚖️ Council Brief</b>');

    // Topic docket
    const topics = gov.council.topicsSummary.slice(0, 3);
    if (topics.length > 0) {
      lines.push(`<i>today's docket: ${topics.map(t => this.esc(t)).join(' · ')}</i>`);
    }
    lines.push('');

    // Vote tally
    const { passed, failed, vetoed, expired } = gov.council.outcomes;
    const totalVotes = gov.council.votesCompleted;
    if (totalVotes > 0) {
      lines.push(`<code>✅ ${passed}   ❌ ${failed}   🛑 ${vetoed}   ⌛ ${expired}</code>   (${totalVotes} total)`);

      // Most recent veto callout
      if (vetoed > 0 && gov.council.vetoes.length > 0) {
        const veto = gov.council.vetoes[0];
        const reason = this.esc(veto.reason.slice(0, 80));
        lines.push(`🛑 ${this.esc(veto.vetoer)} vetoed ${this.esc(veto.domain)} — <i>"${reason}"</i>`);
      }
      lines.push('');
    }

    // Arbiter compliance bar
    if (gov.arbiter.evaluations > 0) {
      const rate = Math.round(gov.arbiter.complianceRate);
      const bar = this.buildUtilizationBar(rate);
      const icon = rate >= 95 ? '🟢' : rate >= 80 ? '🟡' : '🔴';
      lines.push(`Arbiter  <code>${bar}</code>  ${icon} ${rate}%  (${gov.arbiter.evaluations} evals, ${gov.arbiter.violations} violations)`);
    }

    // Quality gates
    if (gov.overseer.gatesChecked > 0) {
      lines.push(`Gates    ${gov.overseer.gatesPassed}/${gov.overseer.gatesChecked} ✓`);
    }

    lines.push('');

    // Verdict
    const hasIssues = gov.arbiter.violations > 0 || gov.overseer.gatesFailed > 0;
    const verdictPrefix = hasIssues ? '⚠' : '✓';
    const verdictParts: string[] = [];
    if (vetoed > 0) verdictParts.push(`${vetoed} veto${vetoed !== 1 ? 'es' : ''} issued`);
    if (gov.arbiter.violations > 0) verdictParts.push(`${gov.arbiter.violations} violation${gov.arbiter.violations !== 1 ? 's' : ''}`);
    if (gov.overseer.gatesFailed > 0) verdictParts.push(`${gov.overseer.gatesFailed} gate${gov.overseer.gatesFailed !== 1 ? 's' : ''} failing`);
    const verdict = verdictParts.length > 0
      ? verdictParts.join('. ')
      : 'System constitutionally sound';
    lines.push(`<i>${verdictPrefix} ${verdict}.</i>`);

    return lines;
  }

  private formatXLikesHtml(items: IntelligenceItem[]): string {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      weekday: 'long', month: 'short', day: 'numeric', timeZone: this.timezone,
    });

    const lines: string[] = [];
    lines.push(`<b>📚 Your Reading List — ${dateStr}</b>`);
    lines.push('');

    if (items.length === 0) {
      lines.push('<i>Nothing from your X likes today.</i>');
      return lines.join('\n');
    }

    // Group by primary domain
    const grouped = new Map<string, IntelligenceItem[]>();
    for (const item of items) {
      const domain = item.domains[0] ?? 'general';
      const group = grouped.get(domain) ?? [];
      group.push(item);
      grouped.set(domain, group);
    }

    const domainEmoji: Record<string, string> = {
      ai: '🤖', programming: '💻', investment: '📈',
      career: '🎯', business: '💡', security: '🛡',
      tools: '🔧', general: '📌',
    };

    for (const [domain, domainItems] of grouped) {
      const emoji = domainEmoji[domain] ?? '📌';
      lines.push(`<b>${emoji} ${domain.charAt(0).toUpperCase() + domain.slice(1)}</b>`);

      for (const item of domainItems.slice(0, 3)) {
        const meta = item.metadata;
        const author = meta?.authorName as string | undefined ?? meta?.authorUsername as string | undefined ?? '';
        const authorStr = author ? `<i>${this.esc(author)}</i>  ` : '';

        // Trim tweet text to 120 chars
        const text = item.summary.length > 120
          ? item.summary.slice(0, 117) + '...'
          : item.summary;

        const engagementNote = typeof meta?.likes === 'number' && meta.likes > 100
          ? ` · ❤️ ${meta.likes}`
          : '';

        if (item.url && !item.url.includes('x.com/i/status')) {
          lines.push(`▸ ${authorStr}<a href="${item.url}">${this.esc(text)}</a>${engagementNote}`);
        } else {
          lines.push(`▸ ${authorStr}${this.esc(text)}${engagementNote}`);
        }
      }

      lines.push('');
    }

    const totalLikes = items.reduce((sum, item) => {
      const meta = item.metadata;
      return sum + (typeof meta?.likes === 'number' ? meta.likes : 0);
    }, 0);

    lines.push(`<i>${items.length} posts from your X likes · ${totalLikes.toLocaleString()} total likes on sourced content</i>`);

    return lines.join('\n');
  }

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

  /** 8-char ASCII progress bar: ████░░░░ */
  private buildUtilizationBar(percent: number): string {
    const filled = Math.round(Math.min(percent, 100) / 12.5);
    return '█'.repeat(filled) + '░'.repeat(8 - filled);
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
