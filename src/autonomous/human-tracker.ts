/**
 * ARI Human 3.0 Tracker — Mind/Body/Spirit/Vocation
 *
 * Tracks Pryce's holistic well-being across four quadrants:
 * - Mind: Learning, reading, skill development
 * - Body: Exercise, sleep, nutrition
 * - Spirit: Family time with Kai (3) and Portland (1), reflection
 * - Vocation: Pryceless Solutions progress, client work, revenue
 *
 * Persists to JSONL at ~/.ari/human/entries.jsonl
 * Uses simple scoring and trend analysis for balance tracking.
 *
 * Layer: L5 (Autonomous Operations)
 */

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';
import type { EventBus } from '../kernel/event-bus.js';
import { createLogger } from '../kernel/logger.js';

const log = createLogger('human-tracker');

// ─── Types ───────────────────────────────────────────────────────────────────

export type Quadrant = 'mind' | 'body' | 'spirit' | 'vocation';

export interface QuadrantEntry {
  id: string;
  quadrant: Quadrant;
  activity: string;
  duration?: number;    // minutes
  quality: number;      // 1-10
  notes?: string;
  timestamp: string;
}

export interface HumanOverview {
  mind: QuadrantSummary;
  body: QuadrantSummary;
  spirit: QuadrantSummary;
  vocation: QuadrantSummary;
  balanceScore: number;  // 0-100
  streak: number;        // days of logging in all 4 quadrants
}

export interface QuadrantSummary {
  recentEntries: number;   // last 7 days
  avgQuality: number;
  topActivities: string[];
  trend: 'improving' | 'stable' | 'declining';
  lastEntry?: string;      // ISO timestamp
}

export interface LifeReview {
  period: { start: string; end: string };
  quadrants: Record<Quadrant, {
    score: number;
    highlights: string[];
    improvements: string[];
  }>;
  overallScore: number;
  balanceInsight: string;
  weeklyGoals: string[];
}

export interface BalanceScore {
  overall: number;       // 0-100
  perQuadrant: Record<Quadrant, number>;
  leastAttended: Quadrant;
  recommendation: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_STORAGE_PATH = path.join(homedir(), '.ari', 'human');
const ENTRIES_FILE = 'entries.jsonl';
const ALL_QUADRANTS: Quadrant[] = ['mind', 'body', 'spirit', 'vocation'];
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const BALANCE_ALERT_THRESHOLD = 30;

// ═══════════════════════════════════════════════════════════════════════════════
// HUMAN TRACKER
// ═══════════════════════════════════════════════════════════════════════════════

export class HumanTracker {
  private readonly storagePath: string;
  private readonly entriesPath: string;
  private readonly eventBus: EventBus;
  private entries: QuadrantEntry[] = [];

  constructor(params: { storagePath?: string; eventBus: EventBus }) {
    this.storagePath = params.storagePath ?? DEFAULT_STORAGE_PATH;
    this.entriesPath = path.join(this.storagePath, ENTRIES_FILE);
    this.eventBus = params.eventBus;

    this.ensureStorageDir();
    this.loadEntries();
  }

  // ── Log an entry ───────────────────────────────────────────────────────────

  logEntry(quadrant: Quadrant, entry: Omit<QuadrantEntry, 'id' | 'quadrant' | 'timestamp'>): void {
    const fullEntry: QuadrantEntry = {
      id: randomUUID(),
      quadrant,
      activity: entry.activity,
      duration: entry.duration,
      quality: Math.max(1, Math.min(10, entry.quality)),
      notes: entry.notes,
      timestamp: new Date().toISOString(),
    };

    this.entries.push(fullEntry);
    this.appendEntry(fullEntry);

    this.eventBus.emit('human:entry_logged', {
      id: fullEntry.id,
      quadrant: fullEntry.quadrant,
      activity: fullEntry.activity,
      quality: fullEntry.quality,
      timestamp: fullEntry.timestamp,
    });

    log.info({ quadrant, activity: entry.activity, quality: entry.quality }, 'Human entry logged');

    // Check balance after logging
    const balance = this.getBalanceScore();
    if (balance.overall < BALANCE_ALERT_THRESHOLD) {
      this.eventBus.emit('human:balance_alert', {
        leastAttended: balance.leastAttended,
        score: balance.overall,
        recommendation: balance.recommendation,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ── Get overview ───────────────────────────────────────────────────────────

  getOverview(): HumanOverview {
    const balance = this.getBalanceScore();

    return {
      mind: this.getQuadrantSummary('mind'),
      body: this.getQuadrantSummary('body'),
      spirit: this.getQuadrantSummary('spirit'),
      vocation: this.getQuadrantSummary('vocation'),
      balanceScore: balance.overall,
      streak: this.calculateStreak(),
    };
  }

  // ── Get quadrant history ───────────────────────────────────────────────────

  getQuadrantHistory(quadrant: Quadrant, days = 7): QuadrantEntry[] {
    const cutoff = Date.now() - days * DAY_MS;
    return this.entries.filter(
      e => e.quadrant === quadrant && new Date(e.timestamp).getTime() > cutoff,
    );
  }

  // ── Generate weekly review ─────────────────────────────────────────────────

  generateWeeklyReview(): LifeReview {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - WEEK_MS);

    const weekEntries = this.entries.filter(
      e => new Date(e.timestamp).getTime() > weekAgo.getTime(),
    );

    const quadrants = {} as Record<Quadrant, {
      score: number;
      highlights: string[];
      improvements: string[];
    }>;

    let totalScore = 0;

    for (const q of ALL_QUADRANTS) {
      const qEntries = weekEntries.filter(e => e.quadrant === q);
      const avgQuality = qEntries.length > 0
        ? qEntries.reduce((sum, e) => sum + e.quality, 0) / qEntries.length
        : 0;

      const score = Math.round(avgQuality * 10);
      totalScore += score;

      const highlights = qEntries
        .filter(e => e.quality >= 7)
        .map(e => e.activity)
        .slice(0, 3);

      const improvements = qEntries.length === 0
        ? [`No ${q} entries this week — prioritize this quadrant`]
        : qEntries.filter(e => e.quality <= 4).map(e => `Improve: ${e.activity}`).slice(0, 3);

      quadrants[q] = { score, highlights, improvements };
    }

    const overallScore = Math.round(totalScore / 4);
    const balance = this.getBalanceScore();

    const review: LifeReview = {
      period: {
        start: weekAgo.toISOString(),
        end: now.toISOString(),
      },
      quadrants,
      overallScore,
      balanceInsight: balance.recommendation,
      weeklyGoals: this.generateGoals(quadrants, balance),
    };

    this.eventBus.emit('human:weekly_review', {
      period: review.period,
      overallScore: review.overallScore,
      timestamp: now.toISOString(),
    });

    log.info({ overallScore, period: review.period }, 'Weekly review generated');
    return review;
  }

  // ── Balance score ──────────────────────────────────────────────────────────

  getBalanceScore(): BalanceScore {
    const perQuadrant = {} as Record<Quadrant, number>;
    let minScore = 100;
    let leastAttended: Quadrant = 'mind';

    for (const q of ALL_QUADRANTS) {
      const recent = this.getQuadrantHistory(q, 7);
      const avgQuality = recent.length > 0
        ? recent.reduce((sum, e) => sum + e.quality, 0) / recent.length
        : 0;

      // Score combines frequency and quality (max 100)
      const frequencyScore = Math.min(recent.length / 7, 1) * 50;
      const qualityScore = (avgQuality / 10) * 50;
      const score = Math.round(frequencyScore + qualityScore);

      perQuadrant[q] = score;

      if (score < minScore) {
        minScore = score;
        leastAttended = q;
      }
    }

    const scores = Object.values(perQuadrant);
    const overall = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    // Penalize imbalance — high variance reduces overall score
    const mean = overall;
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
    const balancePenalty = Math.min(variance / 10, 20);
    const adjustedOverall = Math.max(0, Math.round(overall - balancePenalty));

    const recommendation = this.generateRecommendation(leastAttended, perQuadrant[leastAttended]);

    return {
      overall: adjustedOverall,
      perQuadrant,
      leastAttended,
      recommendation,
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private getQuadrantSummary(quadrant: Quadrant): QuadrantSummary {
    const recent = this.getQuadrantHistory(quadrant, 7);
    const avgQuality = recent.length > 0
      ? Math.round((recent.reduce((sum, e) => sum + e.quality, 0) / recent.length) * 10) / 10
      : 0;

    // Count activity frequency
    const activityCounts = new Map<string, number>();
    for (const entry of recent) {
      activityCounts.set(entry.activity, (activityCounts.get(entry.activity) ?? 0) + 1);
    }
    const topActivities = Array.from(activityCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([activity]) => activity);

    const trend = this.calculateTrend(quadrant);

    const sortedRecent = [...recent].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    return {
      recentEntries: recent.length,
      avgQuality,
      topActivities,
      trend,
      lastEntry: sortedRecent[0]?.timestamp,
    };
  }

  private calculateTrend(quadrant: Quadrant): 'improving' | 'stable' | 'declining' {
    const thisWeek = this.getQuadrantHistory(quadrant, 7);
    const lastWeek = this.entries.filter(e => {
      const time = new Date(e.timestamp).getTime();
      const now = Date.now();
      return e.quadrant === quadrant && time > now - 14 * DAY_MS && time <= now - 7 * DAY_MS;
    });

    if (thisWeek.length === 0 && lastWeek.length === 0) return 'stable';
    if (thisWeek.length === 0) return 'declining';
    if (lastWeek.length === 0) return 'improving';

    const thisAvg = thisWeek.reduce((s, e) => s + e.quality, 0) / thisWeek.length;
    const lastAvg = lastWeek.reduce((s, e) => s + e.quality, 0) / lastWeek.length;

    const diff = thisAvg - lastAvg;
    if (diff > 0.5) return 'improving';
    if (diff < -0.5) return 'declining';
    return 'stable';
  }

  private calculateStreak(): number {
    const now = new Date();
    let streak = 0;

    for (let dayOffset = 0; dayOffset < 365; dayOffset++) {
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);
      dayStart.setDate(dayStart.getDate() - dayOffset);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const dayEntries = this.entries.filter(e => {
        const t = new Date(e.timestamp).getTime();
        return t >= dayStart.getTime() && t < dayEnd.getTime();
      });

      const quadrantsLogged = new Set(dayEntries.map(e => e.quadrant));
      if (quadrantsLogged.size === 4) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  private generateRecommendation(leastAttended: Quadrant, score: number): string {
    const recommendations: Record<Quadrant, string> = {
      mind: 'Consider reading, learning a new skill, or having a deep conversation today.',
      body: 'Schedule some physical activity — even a 20-minute walk counts.',
      spirit: 'Spend quality time with Kai and Portland, or take a moment for personal reflection.',
      vocation: 'Review Pryceless Solutions goals or dedicate time to client work and business development.',
    };

    if (score === 0) {
      return `Your ${leastAttended} quadrant has no entries this week. ${recommendations[leastAttended]}`;
    }

    return `Your ${leastAttended} quadrant needs attention (score: ${score}/100). ${recommendations[leastAttended]}`;
  }

  private generateGoals(
    quadrants: Record<Quadrant, { score: number; highlights: string[]; improvements: string[] }>,
    balance: BalanceScore,
  ): string[] {
    const goals: string[] = [];

    // Goal for least attended quadrant
    goals.push(`Focus on ${balance.leastAttended}: ${balance.recommendation}`);

    // Goals for quadrants with low scores
    for (const q of ALL_QUADRANTS) {
      if (quadrants[q].score < 50 && q !== balance.leastAttended) {
        goals.push(`Improve ${q} quality — current score: ${quadrants[q].score}/100`);
      }
    }

    // Streak goal
    goals.push('Log activity in all 4 quadrants every day to build your streak');

    return goals.slice(0, 5);
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
  }

  private loadEntries(): void {
    if (!fs.existsSync(this.entriesPath)) {
      log.info('No existing entries file, starting fresh');
      return;
    }

    try {
      const data = fs.readFileSync(this.entriesPath, 'utf-8');
      const lines = data.split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as QuadrantEntry;
          this.entries.push(entry);
        } catch {
          log.warn({ line: line.slice(0, 100) }, 'Skipping malformed JSONL line');
        }
      }

      log.info({ count: this.entries.length }, 'Human tracker entries loaded');
    } catch (err) {
      log.error({ error: String(err) }, 'Failed to load entries');
    }
  }

  private appendEntry(entry: QuadrantEntry): void {
    try {
      fs.appendFileSync(this.entriesPath, JSON.stringify(entry) + '\n');
    } catch (err) {
      log.error({ id: entry.id, error: String(err) }, 'Failed to persist entry');
    }
  }
}
