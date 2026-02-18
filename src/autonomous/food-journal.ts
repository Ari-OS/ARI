/**
 * ARI Food Journal — SQLite-backed nutrition tracking with AI photo analysis
 *
 * Tracks daily meals, macros, and calories. Uses Anthropic claude-haiku
 * for food photo recognition and supports Edamam nutrition API lookups.
 *
 * Features:
 *   - SQLite persistence (WAL mode, ~/.ari/food-journal.db)
 *   - Meal logging with macronutrient tracking
 *   - AI food photo analysis via claude-haiku-4-5
 *   - Daily calorie/macro summaries for Telegram
 *   - EventBus integration (health:meal_logged, health:nutrition_summary)
 *
 * Layer: L5 (Autonomous Operations)
 */

import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import type { EventBus } from '../kernel/event-bus.js';
import { createLogger } from '../kernel/logger.js';

const log = createLogger('food-journal');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FoodEntry {
  id: string;
  timestamp: string;
  meal: string;          // breakfast/lunch/dinner/snack
  description: string;
  calories: number;
  protein: number;       // grams
  carbs: number;         // grams
  fat: number;           // grams
  source: 'manual' | 'photo' | 'voice';
}

export interface DailyNutrition {
  date: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  entryCount: number;
  entries: FoodEntry[];
}

interface FoodEntryRow {
  id: string;
  timestamp: string;
  meal: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: string;
}

interface PhotoAnalysisResult {
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meal: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const PHOTO_ANALYSIS_PROMPT = [
  'You are a nutrition expert analyzing a food photo for ARI health tracking.',
  '',
  'Identify the food items visible in the image and estimate their nutritional content.',
  '',
  'Return ONLY valid JSON:',
  '{',
  '  "description": "2 scrambled eggs with toast",',
  '  "meal": "breakfast",',
  '  "calories": 320,',
  '  "protein": 18,',
  '  "carbs": 28,',
  '  "fat": 14',
  '}',
  '',
  'Meal types: breakfast, lunch, dinner, snack',
  'Use your best estimation for nutritional values based on typical serving sizes.',
  'If the image does not contain food, return null for all numeric fields and "unknown" for strings.',
].join('\n');

// ─── Class ──────────────────────────────────────────────────────────────────

export class FoodJournal {
  private readonly db: DatabaseType;
  private readonly eventBus: EventBus;
  private readonly anthropic: Anthropic | null;

  constructor(params: {
    eventBus: EventBus;
    anthropicApiKey?: string;
    edamamAppId?: string;
    edamamAppKey?: string;
  }) {
    this.eventBus = params.eventBus;

    // Initialize Anthropic client if key provided
    this.anthropic = params.anthropicApiKey
      ? new Anthropic({ apiKey: params.anthropicApiKey })
      : null;

    // Ensure ~/.ari directory exists
    const ariDir = join(homedir(), '.ari');
    mkdirSync(ariDir, { recursive: true });

    // Open SQLite database
    const dbPath = join(ariDir, 'food-journal.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');

    // Create table if not exists
    this.db.exec(
      'CREATE TABLE IF NOT EXISTS food_entries (' +
      '  id TEXT PRIMARY KEY,' +
      '  timestamp TEXT NOT NULL,' +
      '  meal TEXT NOT NULL,' +
      '  description TEXT NOT NULL,' +
      '  calories REAL DEFAULT 0,' +
      '  protein REAL DEFAULT 0,' +
      '  carbs REAL DEFAULT 0,' +
      '  fat REAL DEFAULT 0,' +
      '  source TEXT DEFAULT \'manual\'' +
      ')',
    );

    log.info('FoodJournal initialized', { dbPath });
  }

  // ─── Public Methods ────────────────────────────────────────────────────────

  /**
   * Log a food entry to the SQLite database.
   */
  logFood(entry: Omit<FoodEntry, 'id' | 'timestamp'>): FoodEntry {
    const id = randomUUID();
    const timestamp = new Date().toISOString();

    const full: FoodEntry = {
      id,
      timestamp,
      meal: entry.meal,
      description: entry.description,
      calories: entry.calories,
      protein: entry.protein,
      carbs: entry.carbs,
      fat: entry.fat,
      source: entry.source,
    };

    const stmt = this.db.prepare(
      'INSERT INTO food_entries (id, timestamp, meal, description, calories, protein, carbs, fat, source) ' +
      'VALUES (@id, @timestamp, @meal, @description, @calories, @protein, @carbs, @fat, @source)',
    );

    stmt.run(full);

    // Emit health event
    this.eventBus.emit('health:meal_logged', {
      mealId: id,
      description: full.description,
      calories: full.calories,
      timestamp,
    });

    // Emit audit event
    this.eventBus.emit('audit:log', {
      action: 'food:logged',
      agent: 'food-journal',
      trustLevel: 'system',
      details: { id, meal: full.meal, calories: full.calories },
    });

    log.info('Food logged', { id, meal: full.meal, calories: full.calories });

    return full;
  }

  /**
   * Analyze a base64-encoded food photo using claude-haiku-4-5.
   * Returns a partial FoodEntry with AI-estimated nutrition.
   */
  async analyzePhoto(base64Image: string): Promise<Partial<FoodEntry>> {
    if (!this.anthropic) {
      log.warn('analyzePhoto: no Anthropic API key configured, returning empty estimate');
      return {};
    }

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: base64Image,
                },
              },
              {
                type: 'text',
                text: PHOTO_ANALYSIS_PROMPT,
              },
            ],
          },
        ],
      });

      const textBlock = response.content.find((b) => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        log.warn('analyzePhoto: no text content in response');
        return {};
      }

      const raw = textBlock.text.trim();
      const parsed = JSON.parse(raw) as PhotoAnalysisResult;

      this.eventBus.emit('audit:log', {
        action: 'food:photo_analyzed',
        agent: 'food-journal',
        trustLevel: 'system',
        details: { description: parsed.description, calories: parsed.calories },
      });

      return {
        description: typeof parsed.description === 'string' ? parsed.description : '',
        meal: typeof parsed.meal === 'string' ? parsed.meal : 'snack',
        calories: typeof parsed.calories === 'number' ? parsed.calories : 0,
        protein: typeof parsed.protein === 'number' ? parsed.protein : 0,
        carbs: typeof parsed.carbs === 'number' ? parsed.carbs : 0,
        fat: typeof parsed.fat === 'number' ? parsed.fat : 0,
        source: 'photo',
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log.error('analyzePhoto failed', { error: message });
      return {};
    }
  }

  /**
   * Returns daily nutrition totals for a given date (defaults to today).
   */
  getDailyTotals(date?: string): DailyNutrition {
    const targetDate = date ?? new Date().toISOString().slice(0, 10);

    const rows = this.db.prepare(
      'SELECT * FROM food_entries WHERE DATE(timestamp) = ? ORDER BY timestamp ASC',
    ).all(targetDate) as FoodEntryRow[];

    const entries = rows.map((row) => this.rowToEntry(row));

    const totals = entries.reduce(
      (acc, e) => ({
        totalCalories: acc.totalCalories + e.calories,
        totalProtein: acc.totalProtein + e.protein,
        totalCarbs: acc.totalCarbs + e.carbs,
        totalFat: acc.totalFat + e.fat,
      }),
      { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 },
    );

    return {
      date: targetDate,
      ...totals,
      entryCount: entries.length,
      entries,
    };
  }

  /**
   * Returns food entries from the last N days (default: 7).
   */
  getRecentEntries(days = 7): FoodEntry[] {
    const rows = this.db.prepare(
      "SELECT * FROM food_entries WHERE timestamp >= datetime('now', ? || ' days') ORDER BY timestamp DESC",
    ).all(`-${days}`) as FoodEntryRow[];

    return rows.map((row) => this.rowToEntry(row));
  }

  /**
   * Returns a human-readable daily summary suitable for Telegram.
   */
  getDailySummaryText(date?: string): string {
    const nutrition = this.getDailyTotals(date);

    if (nutrition.entryCount === 0) {
      return `No food entries logged for ${nutrition.date}.`;
    }

    const mealLines = nutrition.entries.map(
      (e) => `  • ${e.meal}: ${e.description} (${Math.round(e.calories)} kcal)`,
    );

    const lines = [
      `Nutrition Summary — ${nutrition.date}`,
      '',
      `Calories: ${Math.round(nutrition.totalCalories)} kcal`,
      `Protein:  ${Math.round(nutrition.totalProtein)}g`,
      `Carbs:    ${Math.round(nutrition.totalCarbs)}g`,
      `Fat:      ${Math.round(nutrition.totalFat)}g`,
      '',
      `Meals (${nutrition.entryCount}):`,
      ...mealLines,
    ];

    return lines.join('\n');
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private rowToEntry(row: FoodEntryRow): FoodEntry {
    return {
      id: row.id,
      timestamp: row.timestamp,
      meal: row.meal,
      description: row.description,
      calories: row.calories,
      protein: row.protein,
      carbs: row.carbs,
      fat: row.fat,
      source: this.parseSource(row.source),
    };
  }

  private parseSource(value: string): 'manual' | 'photo' | 'voice' {
    if (value === 'manual' || value === 'photo' || value === 'voice') {
      return value;
    }
    return 'manual';
  }
}
