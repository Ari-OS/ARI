/**
 * ARI Briefings Module
 *
 * Generates intelligent morning briefings and evening summaries
 * that respect the operator's time while keeping him informed.
 *
 * Morning Briefing (7 AM): SMS ping + Notion page
 * - Queued notifications from overnight
 * - Today's priorities
 * - Weather/calendar integration (future)
 *
 * Evening Summary (9 PM): Notion only
 * - Day's accomplishments
 * - Open issues
 * - Tomorrow's priorities
 *
 * Weekly Review (Sunday 6 PM): Notion only
 * - Week's metrics
 * - Patterns and trends
 * - Next week planning
 */

import { NotificationManager } from './notification-manager.js';
import { NotionInbox } from '../integrations/notion/inbox.js';
import { dailyAudit, type DailyAudit } from './daily-audit.js';
import { ChangelogGenerator } from './changelog-generator.js';
import { EventBus } from '../kernel/event-bus.js';
import type { NotionConfig } from './types.js';

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
   * Generate and send morning briefing
   */
  async morningBriefing(): Promise<BriefingResult> {
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

    // Send SMS ping (short, actionable)
    const smsMessage = this.formatMorningSMS(content, queueResult);
    const smsResult = await this.notificationManager.notify({
      category: 'daily',
      title: `Good morning, ${dayName}`,
      body: smsMessage,
      priority: content.issues.length > 0 ? 'normal' : 'low',
    });

    await dailyAudit.logActivity(
      'system_event',
      'Morning Briefing',
      content.summary,
      {
        outcome: 'success',
        details: { type: 'morning', notionPageId },
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
   * Generate and send evening summary
   */
  async eveningSummary(): Promise<BriefingResult> {
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

    // Send evening summary via Telegram for build session prep
    const eveningMessage = this.formatEveningSummary(content);
    await this.notificationManager.notify({
      category: 'daily',
      title: 'Evening Summary',
      body: eveningMessage,
      priority: 'low',
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

    // Send weekly review via Telegram
    await this.notificationManager.notify({
      category: 'daily',
      title: 'Weekly Review',
      body: `${content.summary}\n\n${content.actionItems?.map(a => `- ${a}`).join('\n') ?? ''}`,
      priority: 'normal',
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

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private async getRecentAuditData(): Promise<DailyAudit | null> {
    try {
      return await dailyAudit.getTodayAudit();
    } catch {
      return null;
    }
  }

  private async getWeekAuditData(): Promise<DailyAudit[]> {
    // For now, just get today's data
    // Future: implement multi-day audit retrieval
    const today = await this.getRecentAuditData();
    return today ? [today] : [];
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
    // Extract failed tasks as potential priorities
    const failedTasks = weekData
      .flatMap((d) =>
        d.activities
          .filter((a) => a.outcome === 'failure')
          .map((a) => a.title)
      );

    // Dedupe and suggest top 3
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
