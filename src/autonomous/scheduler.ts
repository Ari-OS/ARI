/**
 * ARI Scheduler
 *
 * Cron-like task scheduling system for proactive operations.
 * Enables ARI to run scheduled tasks autonomously:
 * - Morning briefings (7am)
 * - Knowledge indexing (3x daily)
 * - Changelog generation (7pm)
 * - Evening summaries (9pm)
 * - Agent health checks (every 15min)
 *
 * Uses simple cron expression parsing without external dependencies.
 */

import { EventBus } from '../kernel/event-bus.js';
import { createLogger } from '../kernel/logger.js';

const log = createLogger('scheduler');
import fs from 'node:fs/promises';
import path from 'node:path';

const SCHEDULER_STATE_PATH = path.join(
  process.env.HOME || '~',
  '.ari',
  'scheduler-state.json'
);

export interface ScheduledTask {
  id: string;
  name: string;
  cron: string; // "0 7 * * *" = 7am daily, "*/15 * * * *" = every 15 min
  handler: string; // Method name to call
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  metadata?: Record<string, unknown>;
  essential?: boolean; // If true, runs even when budget is in 'reduce' mode
}

export interface CheckAndRunOptions {
  essentialOnly?: boolean; // If true, only run tasks marked as essential
}

interface SchedulerState {
  tasks: Record<string, { lastRun?: string; enabled: boolean }>;
  lastChecked: string;
}

interface TaskHandler {
  (): Promise<void>;
}

/**
 * Parse a cron expression and determine next run time
 * Supports: minute hour day month weekday
 * Special: asterisk for any, asterisk-slash-N for every N
 */
function parseCronExpression(cron: string, from: Date = new Date()): Date | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const [minutePart, hourPart, dayPart, monthPart, weekdayPart] = parts;

  // Parse each field
  const parseField = (
    field: string,
    min: number,
    max: number
  ): number[] => {
    if (field === '*') {
      return Array.from({ length: max - min + 1 }, (_, i) => min + i);
    }
    if (field.startsWith('*/')) {
      const interval = parseInt(field.slice(2), 10);
      const result: number[] = [];
      for (let i = min; i <= max; i += interval) {
        result.push(i);
      }
      return result;
    }
    if (field.includes(',')) {
      return field.split(',').map((v) => parseInt(v, 10));
    }
    if (field.includes('-')) {
      const [start, end] = field.split('-').map((v) => parseInt(v, 10));
      const result: number[] = [];
      for (let i = start; i <= end; i++) {
        result.push(i);
      }
      return result;
    }
    return [parseInt(field, 10)];
  };

  const minutes = parseField(minutePart, 0, 59);
  const hours = parseField(hourPart, 0, 23);
  const days = parseField(dayPart, 1, 31);
  const months = parseField(monthPart, 1, 12);
  const weekdays = parseField(weekdayPart, 0, 6);

  // Find next matching time (check up to 366 days ahead)
  const next = new Date(from);
  next.setSeconds(0, 0);

  for (let attempts = 0; attempts < 366 * 24 * 60; attempts++) {
    next.setMinutes(next.getMinutes() + 1);

    const minute = next.getMinutes();
    const hour = next.getHours();
    const day = next.getDate();
    const month = next.getMonth() + 1; // 0-indexed
    const weekday = next.getDay();

    if (
      minutes.includes(minute) &&
      hours.includes(hour) &&
      days.includes(day) &&
      months.includes(month) &&
      (weekdayPart === '*' || weekdays.includes(weekday))
    ) {
      return next;
    }
  }

  return null;
}

/**
 * Default scheduled tasks for ARI
 */
const DEFAULT_TASKS: Omit<ScheduledTask, 'lastRun' | 'nextRun'>[] = [
  // ============================================================================
  // ESSENTIAL TASKS - Run even when budget is in 'reduce' mode
  // These are user-facing deliverables that provide core value
  // ============================================================================
  {
    id: 'morning-briefing',
    name: 'Morning Briefing',
    cron: '0 7 * * *', // 7:00 AM daily
    handler: 'morning_briefing',
    enabled: true,
    essential: true, // User-facing deliverable
  },
  {
    id: 'evening-summary',
    name: 'Evening Summary',
    cron: '0 21 * * *', // 9:00 PM daily
    handler: 'evening_summary',
    enabled: true,
    essential: true, // User-facing deliverable
  },
  {
    id: 'agent-health-check',
    name: 'Agent Health Check',
    cron: '*/15 * * * *', // Every 15 minutes
    handler: 'agent_health_check',
    enabled: true,
    essential: true, // System health monitoring
  },
  {
    id: 'changelog-generate',
    name: 'Changelog Generation',
    cron: '0 19 * * *', // 7:00 PM daily
    handler: 'changelog_generate',
    enabled: true,
    essential: true, // User-facing deliverable
  },
  {
    id: 'workday-digest',
    name: 'Work-Day Digest',
    cron: '0 16 * * 1-5', // 4:00 PM weekdays — flush notifications batched during school IT hours
    handler: 'workday_digest',
    enabled: true,
    essential: true, // User-facing deliverable
  },
  {
    id: 'x-likes-digest',
    name: 'X Likes Curated Digest',
    cron: '0 20 * * *', // 8:00 PM daily — reading list from today's X likes
    handler: 'x_likes_digest',
    enabled: true,
    essential: false,
  },

  // ============================================================================
  // NON-ESSENTIAL TASKS - Skipped when budget is constrained
  // ============================================================================
  {
    id: 'knowledge-index-morning',
    name: 'Knowledge Index (Morning)',
    cron: '0 8 * * *', // 8:00 AM daily
    handler: 'knowledge_index',
    enabled: true,
    essential: false,
  },
  {
    id: 'knowledge-index-afternoon',
    name: 'Knowledge Index (Afternoon)',
    cron: '0 14 * * *', // 2:00 PM daily
    handler: 'knowledge_index',
    enabled: true,
    essential: false,
  },
  {
    id: 'knowledge-index-evening',
    name: 'Knowledge Index (Evening)',
    cron: '0 20 * * *', // 8:00 PM daily
    handler: 'knowledge_index',
    enabled: true,
    essential: false,
  },
  {
    id: 'weekly-review',
    name: 'Weekly Review',
    cron: '0 19 * * 0', // Sunday 7:00 PM
    handler: 'weekly_review',
    enabled: true,
    essential: false,
  },
  {
    id: 'weekly-wisdom',
    name: 'Weekly Wisdom Digest',
    cron: '10 19 * * 0', // Sunday 7:10 PM (after weekly_review)
    handler: 'weekly_wisdom',
    enabled: true,
    essential: false,
    metadata: {
      category: 'COGNITION',
      description: 'Synthesizes week of cognitive activity into insights + recommendations',
    },
  },
  {
    id: 'e2e-daily-run',
    name: 'Daily E2E Test Suite',
    cron: '0 9 * * *', // 9:00 AM daily
    handler: 'e2e_daily_run',
    enabled: false, // Disabled: pending Playwright setup
    essential: false, // Skip when budget is constrained
    metadata: {
      description: 'Run automated E2E tests and file issues for failures',
    },
  },
  {
    id: 'self-improvement-daily',
    name: 'Daily Self-Improvement Analysis',
    cron: '30 21 * * *', // 9:30 PM daily (after evening summary at 9:00 PM)
    handler: 'self_improvement_daily',
    enabled: true,
    essential: false,
    metadata: {
      description: 'Analyze E2E results, learning patterns, and system performance',
    },
  },


  // ==========================================================================
  // INITIATIVE ENGINE: Proactive autonomy and user deliverables
  // ==========================================================================

  {
    id: 'initiative-comprehensive-scan',
    name: 'Initiative Comprehensive Scan',
    cron: '30 5 * * *', // 5:30 AM daily (before morning briefing)
    handler: 'initiative_comprehensive_scan',
    enabled: true,
    essential: false, // Background proactive task
    metadata: {
      category: 'PROACTIVE',
      description: 'Comprehensive scan for new work to do autonomously',
    },
  },
  {
    id: 'user-daily-brief',
    name: 'User Daily Brief',
    cron: '30 7 * * *', // 7:30 AM daily (after initiative scan, before work starts)
    handler: 'user_daily_brief',
    enabled: true,
    essential: true, // USER-FACING deliverable - always run
    metadata: {
      category: 'DELIVERABLES',
      description: 'Generate daily focus, action items, and insights for user',
    },
  },
  {
    id: 'initiative-midday-check',
    name: 'Initiative Midday Check',
    cron: '30 14 * * *', // 2:30 PM daily
    handler: 'initiative_midday_check',
    enabled: true,
    essential: false, // Background proactive task
    metadata: {
      category: 'PROACTIVE',
      description: 'Mid-day progress check and urgent initiative execution',
    },
  },

  // ============================================================================
  // MASTER PLAN PHASE 2-4: New scheduled tasks (2026-02-16)
  // All times in Eastern Time (ET)
  // ============================================================================

  // ── Health & Operations ─────────────────────────────────────────────────────
  // NOTE: System health checks run via 'agent-health-check' task above (*/15)
  // Removed duplicate 'health-check' task that was firing at the same interval
  {
    id: 'backup-daily',
    name: 'Daily Backup',
    cron: '0 3 * * *', // 3:00 AM daily
    handler: 'backup_daily',
    enabled: true,
    essential: false,
    metadata: {
      category: 'OPERATIONS',
      description: 'Backup ~/.ari/data/, contexts/, knowledge/ with pruning',
    },
  },
  {
    id: 'git-sync',
    name: 'Git Sync',
    cron: '0 * * * *', // Every hour on the hour
    handler: 'git_sync',
    enabled: true,
    essential: false,
    metadata: {
      category: 'OPERATIONS',
      description: 'Auto-commit and push changes to remote',
    },
  },

  // ── Knowledge & Memory ──────────────────────────────────────────────────────
  {
    id: 'gmail-ingest',
    name: 'Gmail Ingestion',
    cron: '0 7 * * *', // 7:00 AM daily
    handler: 'gmail_ingest',
    enabled: true,
    essential: true, // User-facing knowledge capture
    metadata: {
      category: 'KNOWLEDGE',
      description: 'Scan and ingest important emails into knowledge base',
    },
  },
  {
    id: 'memory-weekly',
    name: 'Weekly Memory Consolidation',
    cron: '0 17 * * 0', // Sunday 5:00 PM
    handler: 'memory_weekly',
    enabled: true,
    essential: false,
    metadata: {
      category: 'KNOWLEDGE',
      description: 'Synthesize weekly patterns, promote stable knowledge to long-term',
    },
  },

  // ── Market & Investment Intelligence ────────────────────────────────────────
  {
    id: 'market-snapshot-30min',
    name: 'Market Snapshot (30-min)',
    cron: '*/30 8-22 * * *', // Every 30 min, 8am–10pm ET (Phase 6)
    handler: 'market_background_collect',
    enabled: true,
    essential: false,
    metadata: {
      category: 'INVESTMENT',
      description: 'Price snapshot every 30 min during market hours, alerts on significant moves',
    },
  },
  {
    id: 'market-background-collect',
    name: 'Market Background Collection',
    cron: '0 */4 * * *', // Every 4 hours (silent baseline data, off-hours)
    handler: 'market_background_collect',
    enabled: true,
    essential: false,
    metadata: {
      category: 'INVESTMENT',
      description: 'Silent price collection for baseline data, only forward critical alerts',
    },
  },
  {
    id: 'market-premarket-briefing',
    name: 'Pre-Market Briefing',
    cron: '15 9 * * 1-5', // 9:15 AM weekdays (before market open)
    handler: 'market_premarket_briefing',
    enabled: true,
    essential: true,
    metadata: {
      category: 'INVESTMENT',
      description: 'Overnight crypto summary + stock pre-market prices',
    },
  },
  {
    id: 'market-postmarket-briefing',
    name: 'Post-Market Briefing',
    cron: '15 16 * * 1-5', // 4:15 PM weekdays (after market close)
    handler: 'market_postmarket_briefing',
    enabled: true,
    essential: true,
    metadata: {
      category: 'INVESTMENT',
      description: 'Day P&L summary, only show movers exceeding threshold',
    },
  },
  {
    id: 'market-weekly-analysis',
    name: 'Market Weekly Analysis',
    cron: '0 18 * * 0', // Sunday 6PM (full weekly digest)
    handler: 'market_weekly_analysis',
    enabled: true,
    essential: false,
    metadata: {
      category: 'INVESTMENT',
      description: 'Full weekly analysis: start vs end, trends, z-scores, portfolio change',
    },
  },
  {
    id: 'portfolio-premarket',
    name: 'Pre-Market Portfolio',
    cron: '0 6 * * 1-5', // 6:00 AM weekdays (before 6:30 AM morning briefing)
    handler: 'portfolio_update',
    enabled: true,
    essential: false,
    metadata: {
      category: 'INVESTMENT',
      description: 'Early portfolio snapshot so lastPortfolio is populated by morning briefing',
    },
  },
  {
    id: 'portfolio-update',
    name: 'Portfolio Update',
    cron: '10 9,16 * * 1-5', // 9:10 AM, 4:10 PM weekdays only
    handler: 'portfolio_update',
    enabled: true,
    essential: false,
    metadata: {
      category: 'INVESTMENT',
      description: 'Update portfolio values and track daily changes',
    },
  },
  {
    id: 'opportunity-daily',
    name: 'Daily Opportunity Scan',
    cron: '5 7 * * *', // 7:05 AM daily
    handler: 'opportunity_daily',
    enabled: true,
    essential: false,
    metadata: {
      category: 'INVESTMENT',
      description: 'Scan for investment, career, content, and side project opportunities',
    },
  },

  // ── Career Tracking ─────────────────────────────────────────────────────────
  {
    id: 'career-scan',
    name: 'Career Opportunity Scan',
    cron: '10 6 * * 1-5', // 6:10 AM weekdays — before 6:30 AM morning briefing
    handler: 'career_scan',
    enabled: true,
    essential: false,
    metadata: {
      category: 'CAREER',
      description: 'Scan job boards for CS/SWE opportunities matching profile',
    },
  },

  // ── AI Evolution ────────────────────────────────────────────────────────────
  {
    id: 'model-evolution',
    name: 'Model Evolution Review',
    cron: '0 10 * * 1', // Monday 10:00 AM
    handler: 'model_evolution',
    enabled: true,
    essential: false,
    metadata: {
      category: 'AI',
      description: 'Review model performance, cost efficiency, and routing optimizations',
    },
  },

  // ── AI Council (Nightly Strategic Review) ───────────────────────────────────
  {
    id: 'ai-council-nightly',
    name: 'AI Council Nightly Review',
    cron: '0 22 * * *', // 10:00 PM daily
    handler: 'ai_council_nightly',
    enabled: true,
    essential: false,
    metadata: {
      category: 'STRATEGIC',
      description: 'Multi-model council review: LeadAnalyst + 4 Specialists + Moderator',
    },
  },

  // ── Apple Ecosystem ────────────────────────────────────────────────────────
  {
    id: 'calendar-poll',
    name: 'Calendar Poll',
    cron: '*/15 6-22 * * *', // Every 15 min during waking hours
    handler: 'calendar_poll',
    enabled: true,
    essential: false,
    metadata: {
      category: 'APPLE',
      description: 'Poll Apple Calendar for events, cache for briefings and meeting detection',
    },
  },
  {
    id: 'reminder-sync',
    name: 'Reminder → Notion Sync',
    cron: '*/30 * * * *', // Every 30 minutes
    handler: 'reminder_sync',
    enabled: true,
    essential: false,
    metadata: {
      category: 'APPLE',
      description: 'Sync new Apple Reminders to Notion tasks (Siri quick-capture flow)',
    },
  },

  // ── CRM & Contact Management ─────────────────────────────────────────────
  {
    id: 'crm-daily-scan',
    name: 'CRM Daily Stale Contact Scan',
    cron: '0 2 * * *', // 2:00 AM daily
    handler: 'crm_daily_scan',
    enabled: true,
    essential: false,
    metadata: {
      category: 'CRM',
      description: 'Scan for stale contacts and generate follow-up alerts',
    },
  },
  {
    id: 'crm-weekly-report',
    name: 'CRM Weekly Report',
    cron: '0 20 * * 0', // Sunday 8:00 PM
    handler: 'crm_weekly_report',
    enabled: true,
    essential: false,
    metadata: {
      category: 'CRM',
      description: 'Weekly CRM stats, stale contacts, and follow-up queue',
    },
  },

  // ── Soul Evolution & Human Tracker ──────────────────────────────────────
  {
    id: 'soul-weekly-reflection',
    name: 'Soul Weekly Reflection',
    cron: '0 22 * * 0', // Sunday 10:00 PM
    handler: 'soul_weekly_reflection',
    enabled: true,
    essential: false,
    metadata: {
      category: 'AUTONOMOUS',
      description: 'Weekly self-reflection, trait evolution proposals',
    },
  },
  {
    id: 'life-review-weekly',
    name: 'Life Review Weekly',
    cron: '0 20 * * 0', // Sunday 8:00 PM
    handler: 'life_review_weekly',
    enabled: true,
    essential: false,
    metadata: {
      category: 'AUTONOMOUS',
      description: 'Weekly Human 3.0 quadrant review and scoring',
    },
  },

  // ── Email Triage ────────────────────────────────────────────────────────
  {
    id: 'email-triage',
    name: 'Email Triage Scan',
    cron: '*/30 7-17 * * 1-5', // Every 30 min during work hours, weekdays
    handler: 'email_triage',
    enabled: false, // Disabled: pending Gmail OAuth setup
    essential: false,
    metadata: {
      category: 'INTEGRATION',
      description: 'Scan and triage inbox using GmailTriage classifier',
    },
  },

  // ── Platform Health Audit ───────────────────────────────────────────────
  {
    id: 'platform-health-audit',
    name: 'Platform Health Audit',
    cron: '0 2 * * *', // 2:00 AM daily
    handler: 'platform_health_audit',
    enabled: true,
    essential: false,
    metadata: {
      category: 'OPERATIONS',
      description: 'Nightly platform health check via operational councils',
    },
  },

  // ── Quick-Win Integrations ─────────────────────────────────────────────────
  {
    id: 'weather-fetch',
    name: 'Weather Fetch',
    cron: '0 6,12,18 * * *', // 6AM, noon, 6PM
    handler: 'weather_fetch',
    enabled: true,
    essential: false,
    metadata: {
      category: 'INTEGRATION',
      description: 'Fetch current weather and forecast from WeatherAPI',
    },
  },
  {
    id: 'tech-news-fetch',
    name: 'Tech News Fetch',
    cron: '0 6,14 * * *', // 6AM and 2PM
    handler: 'tech_news_fetch',
    enabled: true,
    essential: false,
    metadata: {
      category: 'INTEGRATION',
      description: 'Fetch top HN stories and RSS feeds for briefings',
    },
  },
  {
    id: 'github-poll',
    name: 'GitHub Repo Poll',
    cron: '0 7,19 * * *', // 7AM and 7PM
    handler: 'github_poll',
    enabled: true,
    essential: false,
    metadata: {
      category: 'INTEGRATION',
      description: 'Poll ARI GitHub repo for activity, PRs, and notifications',
    },
  },

  // ── Life Monitor ───────────────────────────────────────────────────────────
  {
    id: 'life-monitor-scan',
    name: 'Life Monitor Scan',
    cron: '15 6 * * *', // 6:15 AM daily (after intel scan, before digest)
    handler: 'life_monitor_scan',
    enabled: true,
    essential: true, // Core user-facing — actionable alerts
    metadata: {
      category: 'MONITOR',
      description: 'Scan API credits, subscriptions, system health, budget, stale work, ARI health',
    },
  },

  // ── Content Engine ────────────────────────────────────────────────────────
  {
    id: 'content-daily-drafts',
    name: 'Content Draft Generation',
    cron: '10 7 * * *', // 7:10 AM daily
    handler: 'content_daily_drafts',
    enabled: true,
    essential: false,
    metadata: {
      category: 'CONTENT',
      description: 'Analyze intelligence, generate content drafts for review',
    },
  },
  {
    id: 'content-draft-delivery',
    name: 'Content Draft Delivery',
    cron: '30 7 * * *', // 7:30 AM daily (after generation)
    handler: 'content_draft_delivery',
    enabled: true,
    essential: false,
    metadata: {
      category: 'CONTENT',
      description: 'Send pending drafts to Telegram for Pryce review',
    },
  },

  // ── Intelligence Scanner & Daily Digest ────────────────────────────────────
  {
    id: 'intelligence-scan',
    name: 'Intelligence Scan',
    cron: '0 6 * * *', // 6:00 AM daily (before morning briefing)
    handler: 'intelligence_scan',
    enabled: true,
    essential: true, // Core user-facing deliverable
    metadata: {
      category: 'INTELLIGENCE',
      description: 'Scan Anthropic, OpenAI, xAI, HN, GitHub, X/Twitter for relevant intel',
    },
  },
  {
    id: 'daily-digest-delivery',
    name: 'Daily Digest Delivery',
    cron: '15 7 * * *', // 7:15 AM daily (15 min after morning briefing to avoid duplicates)
    handler: 'daily_digest_delivery',
    enabled: true,
    essential: true, // Core user-facing deliverable
    metadata: {
      category: 'INTELLIGENCE',
      description: 'Generate and deliver curated daily knowledge report via Telegram',
    },
  },
  {
    id: "video-script-generation",
    name: "Video Script Generation",
    cron: "0 10 * * 1", // Monday 10:00 AM
    handler: "video_script_generation",
    enabled: true,
    essential: false,
    metadata: {
      category: "CONTENT",
      description: "Generate weekly video script for PayThePryce content pipeline",
    },
  },
  {
    id: "video-pipeline-status",
    name: "Video Pipeline Status Check",
    cron: "*/4 * * * *", // Every 4 minutes
    handler: "video_pipeline_status",
    enabled: true,
    essential: false,
    metadata: {
      category: "CONTENT",
      description: "Check HeyGen/AssemblyAI/YouTube pipeline job status",
    },
  },
  {
    id: "earnings-analyzer",
    name: "Earnings Analyzer",
    cron: "15 7 * * *", // 7:15 AM daily
    handler: "earnings_analyzer",
    enabled: true,
    essential: false,
    metadata: {
      category: "MARKET",
      description: "Analyze upcoming earnings reports for portfolio holdings",
    },
  },
  {
    id: "food-journal-daily",
    name: "Food Journal Daily Summary",
    cron: "30 21 * * *", // 9:30 PM daily
    handler: "food_journal_daily",
    enabled: true,
    essential: false,
    metadata: {
      category: "HEALTH",
      description: "Send daily nutrition summary via Telegram",
    },
  },
  {
    id: "social-growth-weekly",
    name: "Social Media Growth Report",
    cron: "0 7 * * 1", // Monday 7:00 AM
    handler: "social_growth_weekly",
    enabled: true,
    essential: false,
    metadata: {
      category: "CONTENT",
      description: "Aggregate X + YouTube growth metrics and send weekly report",
    },
  },
  {
    id: "youtube-analytics-daily",
    name: "YouTube Analytics Daily",
    cron: "0 9 * * *", // 9:00 AM daily
    handler: "youtube_analytics_daily",
    enabled: true,
    essential: false,
    metadata: {
      category: "CONTENT",
      description: "Fetch YouTube channel and video analytics",
    },
  },
];

export class Scheduler {
  private eventBus: EventBus;
  private tasks: Map<string, ScheduledTask> = new Map();
  private handlers: Map<string, TaskHandler> = new Map();
  private running = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private lastDate: string = new Date().toISOString().split('T')[0];

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /**
   * Initialize scheduler with default tasks
   */
  async init(): Promise<void> {
    // Load saved state
    await this.loadState();

    // Initialize default tasks
    for (const taskDef of DEFAULT_TASKS) {
      if (!this.tasks.has(taskDef.id)) {
        const nextRun = parseCronExpression(taskDef.cron) ?? undefined;
        this.tasks.set(taskDef.id, {
          ...taskDef,
          nextRun,
        });
      }
    }

    // Calculate next run times for all tasks
    this.recalculateNextRuns();
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.running) return;
    this.running = true;

    // Check every minute for due tasks
    this.checkInterval = setInterval(
      () => void this.checkAndRun(),
      60 * 1000
    );
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.running) return;
    this.running = false;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Register a handler for a task
   */
  registerHandler(handlerName: string, handler: TaskHandler): void {
    this.handlers.set(handlerName, handler);
  }

  /**
   * Check for due tasks and run them
   *
   * @param options - Optional settings
   * @param options.essentialOnly - If true, only runs tasks marked as essential (for budget reduce mode)
   */
  async checkAndRun(options: CheckAndRunOptions = {}): Promise<void> {
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];

    // Check for date change (midnight rollover)
    if (currentDate !== this.lastDate) {
      this.eventBus.emit('scheduler:daily_reset', {
        date: currentDate,
        previousDate: this.lastDate,
      });

      // Emit budget:daily_reset for budget tracking components
      this.eventBus.emit('budget:daily_reset', {
        previousUsage: 0, // Budget tracker will update this internally
        profile: 'balanced',
      });

      this.lastDate = currentDate;
    }

    for (const [taskId, task] of this.tasks.entries()) {
      if (!task.enabled) continue;
      if (!task.nextRun) continue;

      // Skip non-essential tasks when in essentialOnly mode
      if (options.essentialOnly && !task.essential) {
        continue;
      }

      if (now >= task.nextRun) {
        await this.runTask(taskId);
      }
    }

    await this.saveState();
  }

  /**
   * Run a specific task
   */
  private async runTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    const startTime = new Date();

    this.eventBus.emit('scheduler:task_run', {
      taskId,
      taskName: task.name,
      startedAt: startTime,
    });

    try {
      // Get handler
      const handler = this.handlers.get(task.handler);

      if (handler) {
        await handler();
      } else {
        log.warn({ handler: task.handler }, 'No handler registered for task');
      }

      // Update task
      task.lastRun = startTime;
      task.nextRun = parseCronExpression(task.cron) ?? undefined;

      const duration = Date.now() - startTime.getTime();

      this.eventBus.emit('scheduler:task_complete', {
        taskId,
        taskName: task.name,
        duration,
        success: true,
        triggeredBy: 'scheduler',
      });
    } catch (error) {
      const duration = Date.now() - startTime.getTime();

      log.error({ taskId, err: error }, 'Scheduler task failed');

      this.eventBus.emit('scheduler:task_complete', {
        taskId,
        taskName: task.name,
        duration,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        triggeredBy: 'scheduler',
      });

      // Still update nextRun to prevent infinite retry
      task.lastRun = startTime;
      task.nextRun = parseCronExpression(task.cron) ?? undefined;
    }
  }

  /**
   * Add a new scheduled task
   */
  addTask(task: Omit<ScheduledTask, 'nextRun'>): void {
    const nextRun = parseCronExpression(task.cron) ?? undefined;
    this.tasks.set(task.id, { ...task, nextRun });
  }

  /**
   * Remove a scheduled task
   */
  removeTask(taskId: string): boolean {
    return this.tasks.delete(taskId);
  }

  /**
   * Enable or disable a task
   */
  setTaskEnabled(taskId: string, enabled: boolean): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    task.enabled = enabled;
    if (enabled) {
      task.nextRun = parseCronExpression(task.cron) ?? undefined;
    }

    return true;
  }

  /**
   * Get all scheduled tasks
   */
  getTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get a specific task
   */
  getTask(taskId: string): ScheduledTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Manually trigger a task (bypass schedule)
   */
  async triggerTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    await this.runTask(taskId);
    return true;
  }

  /**
   * Recalculate next run times for all tasks
   */
  private recalculateNextRuns(): void {
    const now = new Date();

    for (const task of this.tasks.values()) {
      if (!task.enabled) continue;

      // Calculate from last run if available, otherwise from now
      const from = task.lastRun ? new Date(task.lastRun) : now;
      let nextRun = parseCronExpression(task.cron, from) ?? undefined;

      // If the calculated nextRun is already in the past (e.g. daemon restarted
      // after a scheduled task's window passed), recalculate from now so the
      // task doesn't fire immediately on startup at the wrong time of day.
      if (nextRun && nextRun <= now) {
        nextRun = parseCronExpression(task.cron, now) ?? undefined;
      }

      task.nextRun = nextRun;
    }
  }

  /**
   * Load scheduler state from disk
   */
  private async loadState(): Promise<void> {
    try {
      const data = await fs.readFile(SCHEDULER_STATE_PATH, 'utf-8');
      const state = JSON.parse(data) as SchedulerState;

      // Restore task states
      for (const [taskId, taskState] of Object.entries(state.tasks)) {
        const existingTask = this.tasks.get(taskId);
        if (existingTask) {
          existingTask.lastRun = taskState.lastRun
            ? new Date(taskState.lastRun)
            : undefined;
          existingTask.enabled = taskState.enabled;
        }
      }
    } catch {
      // No state file, start fresh
    }
  }

  /**
   * Save scheduler state to disk
   */
  private async saveState(): Promise<void> {
    const state: SchedulerState = {
      tasks: {},
      lastChecked: new Date().toISOString(),
    };

    for (const [taskId, task] of this.tasks.entries()) {
      state.tasks[taskId] = {
        lastRun: task.lastRun?.toISOString(),
        enabled: task.enabled,
      };
    }

    const dir = path.dirname(SCHEDULER_STATE_PATH);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(SCHEDULER_STATE_PATH, JSON.stringify(state, null, 2));
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    running: boolean;
    taskCount: number;
    enabledCount: number;
    nextTask?: { id: string; name: string; nextRun: Date };
  } {
    let nextTask: { id: string; name: string; nextRun: Date } | undefined;
    let enabledCount = 0;

    for (const task of this.tasks.values()) {
      if (task.enabled) {
        enabledCount++;
        if (task.nextRun) {
          if (!nextTask || task.nextRun < nextTask.nextRun) {
            nextTask = {
              id: task.id,
              name: task.name,
              nextRun: task.nextRun,
            };
          }
        }
      }
    }

    return {
      running: this.running,
      taskCount: this.tasks.size,
      enabledCount,
      nextTask,
    };
  }
}

// Export cron parser for testing
export { parseCronExpression };
