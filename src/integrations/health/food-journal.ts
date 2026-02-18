/**
 * FOOD JOURNAL — Meal logging and nutrition tracking for ARI
 *
 * Persists meal entries to JSONL at ~/.ari/health/meals.jsonl.
 * Provides daily summaries, weekly trends, and consistency scoring.
 *
 * Phase 21: Food Journal & Health Tracking
 */

import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { EventBus } from '../../kernel/event-bus.js';
import { createLogger } from '../../kernel/logger.js';

const log = createLogger('food-journal');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MealEntry {
  id: string;
  timestamp: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  description: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  photoPath?: string;
}

export interface NutritionSummary {
  date: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  mealCount: number;
  hydrationGoalMet: boolean;
}

export interface WeeklyNutritionTrend {
  avgCalories: number;
  avgProtein: number;
  consistencyScore: number;
  bestDay: string;
  suggestions: string[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_STORAGE_PATH = join(homedir(), '.ari', 'health');
const MEALS_FILE = 'meals.jsonl';
const DAILY_CALORIE_TARGET = 2200;
const DAILY_PROTEIN_TARGET = 150; // grams
const HYDRATION_MEALS_THRESHOLD = 3; // at least 3 logged meals implies hydration awareness

// ─── Journal ────────────────────────────────────────────────────────────────

export class FoodJournal {
  private readonly storagePath: string;
  private readonly mealsFilePath: string;
  private readonly eventBus: EventBus;

  constructor(params: {
    storagePath?: string;
    eventBus: EventBus;
  }) {
    this.storagePath = params.storagePath ?? DEFAULT_STORAGE_PATH;
    this.mealsFilePath = join(this.storagePath, MEALS_FILE);
    this.eventBus = params.eventBus;

    this.ensureStorageDir();
  }

  /**
   * Log a meal entry. Auto-generates ID and timestamp if not provided.
   */
  logMeal(entry: MealEntry): void {
    const normalized: MealEntry = {
      ...entry,
      id: entry.id || randomUUID(),
      timestamp: entry.timestamp || new Date().toISOString(),
    };

    const line = JSON.stringify(normalized) + '\n';
    appendFileSync(this.mealsFilePath, line, 'utf8');

    log.info(
      { id: normalized.id, mealType: normalized.mealType, calories: normalized.calories },
      'Meal logged',
    );

    this.eventBus.emit('audit:log', {
      action: 'health:meal_logged',
      agent: 'system',
      trustLevel: 'operator',
      details: {
        id: normalized.id,
        mealType: normalized.mealType,
        calories: normalized.calories ?? 0,
      },
    });
  }

  /**
   * Get today's nutrition summary.
   */
  getTodaySummary(): NutritionSummary {
    const today = this.todayDateStr();
    return this.getSummaryForDate(today);
  }

  /**
   * Get weekly nutrition trends for the last 7 days.
   */
  getWeeklyTrend(): WeeklyNutritionTrend {
    const days: NutritionSummary[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      days.push(this.getSummaryForDate(dateStr));
    }

    const daysWithData = days.filter(d => d.mealCount > 0);
    const totalCalories = daysWithData.reduce((sum, d) => sum + d.totalCalories, 0);
    const totalProtein = daysWithData.reduce((sum, d) => sum + d.totalProtein, 0);
    const dataCount = daysWithData.length || 1;

    const avgCalories = Math.round(totalCalories / dataCount);
    const avgProtein = Math.round(totalProtein / dataCount);

    // Consistency: how many of the 7 days have logged meals
    const consistencyScore = Math.round((daysWithData.length / 7) * 100);

    // Best day: highest calorie match to target
    const bestDay = daysWithData.length > 0
      ? daysWithData.reduce((best, d) => {
        const bestDiff = Math.abs(best.totalCalories - DAILY_CALORIE_TARGET);
        const currDiff = Math.abs(d.totalCalories - DAILY_CALORIE_TARGET);
        return currDiff < bestDiff ? d : best;
      }).date
      : this.todayDateStr();

    const suggestions = this.generateSuggestions(avgCalories, avgProtein, consistencyScore);

    return { avgCalories, avgProtein, consistencyScore, bestDay, suggestions };
  }

  /**
   * Get all entries for a specific date (YYYY-MM-DD).
   */
  getEntries(date: string): MealEntry[] {
    const allEntries = this.readAllEntries();
    return allEntries.filter(e => e.timestamp.startsWith(date));
  }

  // ─── Private ────────────────────────────────────────────────────────────

  private getSummaryForDate(date: string): NutritionSummary {
    const entries = this.getEntries(date);

    const totalCalories = entries.reduce((s, e) => s + (e.calories ?? 0), 0);
    const totalProtein = entries.reduce((s, e) => s + (e.protein ?? 0), 0);
    const totalCarbs = entries.reduce((s, e) => s + (e.carbs ?? 0), 0);
    const totalFat = entries.reduce((s, e) => s + (e.fat ?? 0), 0);

    return {
      date,
      totalCalories,
      totalProtein,
      totalCarbs,
      totalFat,
      mealCount: entries.length,
      hydrationGoalMet: entries.length >= HYDRATION_MEALS_THRESHOLD,
    };
  }

  private readAllEntries(): MealEntry[] {
    if (!existsSync(this.mealsFilePath)) return [];

    try {
      const content = readFileSync(this.mealsFilePath, 'utf8');
      return content
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => {
          try {
            return JSON.parse(line) as MealEntry;
          } catch {
            log.warn({ line: line.slice(0, 50) }, 'Skipping malformed JSONL line');
            return null;
          }
        })
        .filter((e): e is MealEntry => e !== null);
    } catch (error) {
      log.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to read meals file',
      );
      return [];
    }
  }

  private generateSuggestions(
    avgCalories: number,
    avgProtein: number,
    consistencyScore: number,
  ): string[] {
    const suggestions: string[] = [];

    if (consistencyScore < 50) {
      suggestions.push('Log meals more consistently — aim for at least 5 of 7 days.');
    }

    if (avgCalories > 0 && avgCalories < DAILY_CALORIE_TARGET * 0.7) {
      suggestions.push(`Average calories (${avgCalories}) are below target. Consider adding nutrient-dense snacks.`);
    } else if (avgCalories > DAILY_CALORIE_TARGET * 1.3) {
      suggestions.push(`Average calories (${avgCalories}) are above target. Review portion sizes.`);
    }

    if (avgProtein > 0 && avgProtein < DAILY_PROTEIN_TARGET * 0.7) {
      suggestions.push(`Protein intake (${avgProtein}g avg) is low. Add lean protein sources.`);
    }

    if (suggestions.length === 0) {
      suggestions.push('Nutrition tracking looks solid. Keep it up.');
    }

    return suggestions;
  }

  private ensureStorageDir(): void {
    if (!existsSync(this.storagePath)) {
      mkdirSync(this.storagePath, { recursive: true });
      log.info({ path: this.storagePath }, 'Created health storage directory');
    }
  }

  private todayDateStr(): string {
    return new Date().toISOString().split('T')[0];
  }
}
